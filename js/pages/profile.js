import { h, icon, img } from '../dom.js';
import { api } from '../api.js';
import { getOptions } from '../meta.js';
import { getUser, setUser, subscribe } from '../auth.js';
import { openAuthModal } from '../modals/auth.js';
import { createField, createSelect, applyServerErrors } from '../components/field.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { errorState, emptyState, ageBadge } from '../components/cards.js';
import { navigate } from '../router.js';
import { validateMobile } from '../validation.js';
import { ageFrom, parseDate, todayYmd, price, shortDate, minusHours } from '../format.js';

export function mount(root, ctx) {
  let tab = ctx.query.get('tab') === 'tickets' ? 'tickets' : 'info';
  let orders = null;
  let alive = true;
  let unsub = () => {};
  const shell = h('div', { class: 'profile-page' });
  root.append(shell);

  const start = () => {
    if (!getUser()) {
      // Protected page: ask for login; if they back out, go home.
      shell.replaceChildren(h('div', { class: 'state' }, h('span', { class: 'ico' }, icon('user', 22)), h('h3', null, 'Please log in'), h('p', null, 'Log in to manage your profile and tickets.')));
      openAuthModal({ mode: 'login', onSuccess: () => alive && build(), onCancel: () => { if (alive && !getUser()) navigate('/'); } });
      return;
    }
    build();
  };

  function build() {
    unsub();
    const tabs = h('div', { class: 'ptabs', role: 'tablist' });
    const panel = h('div', { class: 'ppanel', role: 'tabpanel' });
    const badge = h('span', { class: 'tab-count', hidden: true });
    const mk = (id, label, extra) => h('button', { type: 'button', role: 'tab', class: `ptab${tab === id ? ' is-active' : ''}`, 'aria-selected': String(tab === id),
      onclick: () => { tab = id; history.replaceState(null, '', id === 'tickets' ? '/profile?tab=tickets' : '/profile'); tabs.querySelectorAll('.ptab').forEach((t) => { const on = t.dataset.id === id; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); }); show(); } }, label, extra);
    const t1 = mk('info', 'Personal Information'); t1.dataset.id = 'info';
    const t2 = mk('tickets', 'My Tickets', badge); t2.dataset.id = 'tickets';
    tabs.append(t1, t2);
    shell.replaceChildren(h('h1', null, 'My Profile'), tabs, panel);

    const setBadge = () => { const n = (orders || []).filter((o) => o.isUpcoming).length; badge.textContent = n; badge.hidden = !orders || n === 0; };
    const show = () => (tab === 'info' ? infoTab(panel) : ticketsTab(panel, () => orders, (o) => { orders = o; setBadge(); }));
    // count badge needs the tickets even when the info tab is showing
    api.tickets().then((o) => { orders = o; setBadge(); }).catch(() => {});
    show();
    unsub = subscribe((u) => { if (!u && alive) navigate('/'); });
  }

  start();
  return { destroy: () => { alive = false; unsub(); } };
}

// ---------------------------------------------------------------- personal information
function infoTab(panel) {
  const user = getUser();
  panel.replaceChildren(h('div', { class: 'skeleton', style: { height: '320px', maxWidth: '640px' } }));
  getOptions().then((options) => {
    if (!panel.isConnected) return;
    const name = createField({ label: 'Full name', name: 'fullName', value: user.fullName || '', placeholder: 'e.g. Text', autocomplete: 'name',
      validate: (v) => (!v.trim() ? 'Name is required' : v.trim().length < 3 ? 'Name must be at least 3 characters' : v.trim().length > 50 ? 'Name must not exceed 50 characters' : '') });
    const email = createField({ label: 'Email', name: 'email', value: user.email, readOnly: true, hint: 'Set at registration and cannot be changed' });
    const mobile = createField({ label: 'Mobile number', name: 'mobileNumber', type: 'tel', value: user.mobileNumber ? user.mobileNumber.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3') : '', placeholder: '5XX XXX XXX', autocomplete: 'tel-national', validate: validateMobile });
    const dob = createField({ label: 'Date of birth', name: 'dateOfBirth', type: 'date', value: user.dateOfBirth || '',
      validate: (v) => {
        if (!v) return 'Date of birth is required';
        if (parseDate(v) > new Date()) return 'Please enter a valid date of birth';
        return ageFrom(v) < 12 ? 'You must be at least 12 years old to create an account' : '';
      } });
    dob.input.max = todayYmd();
    const venue = createSelect({ label: 'Preferred Venue', name: 'preferredVenueId', optional: true, value: user.preferredVenue ? user.preferredVenue.id : '', placeholder: 'Select a venue',
      options: options.venues.map((v) => ({ value: v.id, label: `${v.name} · ${v.city}` })), onChange: refresh });
    const fields = { fullName: name, mobileNumber: mobile, dateOfBirth: dob };

    const status = h('div');
    const eligibility = h('p', { class: 'eligibility' });
    const formError = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const save = h('button', { type: 'submit', class: 'btn btn-red btn-lg', disabled: true }, 'Save changes');
    const initial = () => JSON.stringify([user.fullName || '', (user.mobileNumber || '').replace(/\s/g, ''), user.dateOfBirth || '', String(user.preferredVenue ? user.preferredVenue.id : '')]);
    const current = () => JSON.stringify([name.value.trim(), mobile.value.replace(/\s/g, ''), dob.value, venue.value]);
    const allValid = () => name.isValid() && mobile.isValid() && dob.isValid();
    let busy = false;

    function refresh() {
      save.disabled = busy || current() === initial() || !allValid(); // disabled until changed and valid
      const u = getUser();
      status.replaceChildren(u.profileComplete
        ? h('div', { class: 'profile-ok' }, 'Profile Complete ✓')
        : h('div', { class: 'profile-warn', role: 'status' }, icon('alert', 16), 'Please complete your profile to enable booking.'));
      const age = u.age;
      eligibility.textContent = age == null ? 'Add your date of birth to see which films you can book.'
        : age >= 18 ? `You are ${age}, you can buy tickets for all age ratings.`
        : age >= 16 ? `You are ${age}, you cannot buy tickets for 18+ titles.`
        : `You are ${age}, you cannot buy tickets for 16+ or 18+ titles.`;
    }
    [name, mobile, dob].forEach((f) => f.input.addEventListener('input', refresh));
    dob.input.addEventListener('change', () => { dob.touch(); refresh(); });
    dob.input.addEventListener('blur', refresh); name.input.addEventListener('blur', refresh); mobile.input.addEventListener('blur', refresh);

    const form = h('form', { class: 'profile-form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      if (busy) return;
      formError.hidden = true;
      if (![name.touch(), mobile.touch(), dob.touch()].every(Boolean)) return;
      busy = true; save.classList.add('is-loading'); refresh();
      try {
        const saved = await api.updateProfile({ fullName: name.value.trim(), mobileNumber: mobile.value.replace(/\s/g, ''), dateOfBirth: dob.value, preferredVenueId: venue.value });
        setUser(saved); // everything shown now comes from the server response
        Object.assign(user, saved);
        mobile.setValue(saved.mobileNumber ? saved.mobileNumber.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3') : mobile.value);
        toast('Profile saved.', { type: 'success' });
      } catch (err) {
        if (err.status === 422 && err.errors) { const rest = applyServerErrors(err.errors, fields); if (rest.length) { formError.textContent = rest[0]; formError.hidden = false; } }
        else if (err.status !== 401) { formError.textContent = err.message; formError.hidden = false; }
      } finally { busy = false; save.classList.remove('is-loading'); refresh(); }
    } }, formError, name.el, email.el, mobile.el, dob.el, venue.el, save);

    panel.replaceChildren(h('div', { class: 'info-grid' }, h('div', null, form),
      h('aside', { class: 'info-side' }, status, h('h3', null, 'Booking eligibility'), eligibility)));
    refresh();
  }).catch((e) => panel.replaceChildren(errorState(e.message, () => infoTab(panel), "Couldn't load your profile")));
}

// ---------------------------------------------------------------- tickets
function ticketsTab(panel, getOrders, setOrders) {
  let sub = 'upcoming';
  const load = async () => {
    panel.replaceChildren(...[0, 1].map(() => h('div', { class: 'skeleton', style: { height: '150px', borderRadius: '24px', marginBottom: '16px' } })));
    try { setOrders(await api.tickets()); draw(); }
    catch (e) { panel.replaceChildren(errorState(e.message, load, "Couldn't load your tickets")); }
  };

  function draw() {
    const all = getOrders() || [];
    const upcoming = all.filter((o) => o.isUpcoming), past = all.filter((o) => !o.isUpcoming);
    const list = sub === 'upcoming' ? upcoming : past;
    const seg = (id, label, n) => h('button', { type: 'button', class: `seg${sub === id ? ' is-active' : ''}`, 'aria-pressed': String(sub === id), onclick: () => { sub = id; draw(); } }, label, h('small', null, n));
    panel.replaceChildren(h('div', { class: 'segmented' }, seg('upcoming', 'Upcoming', upcoming.length), seg('past', 'Past', past.length)),
      list.length ? h('div', { class: 'tickets-list' }, list.map((o) => orderCard(o, sub === 'upcoming')))
        : sub === 'upcoming'
          ? emptyState({ title: 'No upcoming tickets', message: "You haven't booked anything yet. Find a film and pick your seats.", actionLabel: 'Browse sessions', href: '/sessions', iconName: 'ticket' })
          : emptyState({ title: 'No past tickets', message: 'Tickets for finished sessions and refunded orders show up here.', iconName: 'ticket' }));
  }

  function orderCard(o, withActions) {
    const s = o.session, m = s.movie;
    const refundBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-block', disabled: !o.isRefundable || null, onclick: () => refund(o, refundBtn) }, 'Refund');
    const reason = o.isRefundable ? `Refundable until ${minusHours(s.date, s.time, 2)}` : 'Refunds close 2 hours before the session starts.';
    return h('article', { class: 'order' },
      h('div', { class: 'order-poster' }, img(m.posterUrl, `${m.title} poster`, '')),
      h('div', { class: 'order-main' },
        h('div', { class: 'order-title' }, h('a', { href: `/movies/${m.slug}` }, m.title.toUpperCase()), ageBadge(m), h('span', { class: 'muted' }, `${m.runtimeMinutes} min`), o.status === 'refunded' && h('span', { class: 'badge badge-amber' }, 'Refunded')),
        h('dl', { class: 'order-meta' },
          h('div', null, h('dt', null, 'DATE'), h('dd', null, `${shortDate(s.date)} · ${s.time}`)),
          h('div', null, h('dt', null, 'VENUE'), h('dd', null, `${s.venue.name} · Hall ${s.hall.name}`)),
          h('div', null, h('dt', null, 'FORMAT'), h('dd', null, `${s.format.name} · ${s.language.name}`))),
        h('div', { class: 'order-seats' }, h('small', null, 'SEATS'), o.tickets.map((t) => h('span', { class: 'chip' }, `${t.seatCode} · ${t.ticketType.name}`)))),
      h('div', { class: 'order-side' },
        h('div', null, h('small', null, 'ORDER'), h('b', { class: 'ref-code' }, `#${o.reference}`)),
        h('div', { class: 'paid' }, h('span', null, 'Total paid'), h('b', null, price(o.totalPrice))),
        withActions && h('div', { class: 'refund-box' }, refundBtn, h('p', { class: 'muted' }, reason))));
  }

  async function refund(o, btn) {
    const ok = await confirmDialog({ title: 'Refund this order?', message: `${o.session.movie.title} · ${shortDate(o.session.date)} ${o.session.time}. The seats will be released and this can't be undone.`, confirmLabel: 'Yes, refund', danger: true });
    if (!ok || btn.disabled) return;
    btn.disabled = true; btn.classList.add('is-loading');
    try {
      const updated = await api.refund(o.reference);
      setOrders(getOrders().map((x) => (x.reference === updated.reference ? updated : x))); // use the server's version of the order
      toast('Refund processed. Your seats have been released.', { type: 'success' });
    } catch (e) {
      if (e.status !== 401) toast(e.message, { type: 'error' });
      // the server is the source of truth: reload so the button reflects reality
      try { setOrders(await api.tickets()); } catch { /* keep the list we have */ }
    }
    draw();
  }

  if (getOrders()) draw(); else load();
}

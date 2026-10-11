import { h, icon } from '../dom.js';
import { api } from '../api.js';
import { getOptions } from '../meta.js';
import { openModal, closeButton, infoDialog } from '../components/modal.js';
import { createField, applyServerErrors, validators } from '../components/field.js';
import { toast } from '../components/toast.js';
import { requireAuth } from './auth.js';
import { getUser, isAgeBlocked, ageBlockMessage } from '../auth.js';
import { navigate, render as refreshRoute } from '../router.js';
import { longDate, price, money, mmss } from '../format.js';
import { errorState } from '../components/cards.js';
import { validateMobile } from '../validation.js';

/** შესასვლელი წერტილი სეანსის ბარათიდან. გახსნამდე ამოწმებს პირობებს: ავტორიზაცია, სრული პროფილი, ასაკი. */
export function openBooking(session, movie) {
  return requireAuth(() => {
    const film = session.movie || movie;
    const user = getUser();
    if (!user.profileComplete) {
      toast('Please complete your profile to enable booking.', { type: 'error' });
      navigate('/profile');
      return;
    }
    if (isAgeBlocked(film)) { infoDialog({ title: 'Age restriction', message: ageBlockMessage(film) }); return; }
    run(session, film);
  });
}

// ჯავშნის მოდალის მთავარი ლოგიკა. S - მოდალის მდგომარეობა: ეტაპი, დარბაზის რუკა, არჩეული ადგილები,
// ჯავშანი (hold), ტაიმერი, შეტყობინება, დაკავებულობის დროშები.
function run(session, movie) {
  // მდგომარეობა ერთ ობიექტშია, რომ ყველა ქვეფუნქცია ერთსა და იმავე მონაცემს ხედავდეს
  const S = {
    step: 1, options: null, map: null, mapState: 'loading', mapError: '', selection: new Map(), soldCodes: new Set(),
    hold: null, timer: null, banner: null, notice: '', busy: false, completed: false, order: null, firstLoad: true,
  };
  const modal = openModal({ className: 'modal-booking', label: `Book ${movie.title}`, onClose: onClosed });
  // ჯავშნის უკუთვლის ინდიკატორი (ჩანს მხოლოდ hold-ის შემდეგ)
  const timerChip = h('div', { class: 'hold-chip', hidden: true, role: 'timer' }, h('small', null, 'SEATS HELD'), h('b', null, '8:00'));
  const stepbar = h('div', { class: 'stepbar' });
  const body = h('div', { class: 'booking-body' });
  const when = `${session.venue.name} · Hall ${session.hall.name} · ${longDate(session.date)} · ${session.time} · ${session.format.name} · ${session.language.name}`;
  modal.setContent(
    h('div', { class: 'booking-head' }, h('div', null, h('h2', { class: 'modal-title' }, movie.title.toUpperCase()), h('p', { class: 'modal-sub' }, when)), h('div', { class: 'booking-head-r' }, timerChip, closeButton(() => modal.close('x')))),
    stepbar, body);

  // დამხმარე გამოთვლები: ადგილების ლიმიტი, ხელმისაწვდომი ბილეთის ტიპები (Child იმალება 16+/18+ ფილმზე),
  // ბილეთის ფასი = სეანსის ფასი × ტიპის კოეფიციენტი (Adult 100%, Child 60%, Student 75%).
  const maxSeats = () => (S.options ? S.options.maxSeatsPerOrder : 3);
  const ticketTypes = () => S.options.ticketTypes.filter((t) => !(t.blockedFromRatingAge != null && movie.ageRating.minAge >= t.blockedFromRatingAge));
  const ratio = (slug) => (S.options.ticketTypes.find((t) => t.slug === slug) || { priceRatio: 1 }).priceRatio;
  const seatPrice = (sel) => money(session.price * ratio(sel.ticketType));
  const subtotal = () => money([...S.selection.values()].reduce((n, s) => n + seatPrice(s), 0));

  // ---- სასიცოცხლო ციკლი ---------------------------------------------------------
  function onClosed() {
    stopTimer();
    if (S.hold && !S.completed) api.releaseHold(S.hold.holdId).catch(() => {}); // ადგილებს მაშინვე ვათავისუფლებთ
    if (S.completed) refreshRoute({ scroll: false }); // დარჩენილი ადგილების რაოდენობა ახლა მოძველებულია - გვერდს ვაახლებთ
  }
  // 8-წუთიანი ტაიმერი: ითვლის სერვერის მიერ დაბრუნებულ expiresAt-მდე; ნულზე ჯავშანი მთავრდება
  function startTimer(hold) {
    stopTimer();
    const end = Date.parse(hold.expiresAt) || Date.now() + (hold.secondsRemaining || 0) * 1000;
    const tick = () => {
      const left = (end - Date.now()) / 1000;
      timerChip.querySelector('b').textContent = mmss(left);
      timerChip.classList.toggle('is-low', left <= 60);
      if (left <= 0) expire('Your hold time expired. Please re-select your seats.');
    };
    timerChip.hidden = false; tick();
    S.timer = setInterval(tick, 250);
  }
  function stopTimer() { clearInterval(S.timer); S.timer = null; timerChip.hidden = true; }

  /** ჯავშანი აღარ არსებობს (ტაიმერი ამოიწურა ან სერვერმა თქვა): ვბრუნდებით 1-ელ ეტაპზე, ვტვირთავთ რუკას და ვუხსნით მიზეზს. */
  function expire(message) {
    stopTimer();
    S.hold = null; S.selection.clear(); S.step = 1; S.busy = false; modal.setDismissible(true);
    S.banner = { type: 'warn', text: message };
    loadMap(); paint();
  }

  // ვტვირთავთ დარბაზის რუკას და ფილტრის პარამეტრებს ერთად; რუკა მთლიანად API პასუხიდან იხატება
  async function loadMap() {
    S.mapState = 'loading';
    if (S.step === 1) paint();
    try {
      const [options, map] = await Promise.all([getOptions(), api.seats(session.id)]);
      S.options = options; S.map = map; S.mapState = 'ready';
      if (S.firstLoad) { // ვაღდგენთ მომხმარებლის საკუთარ, ჯერ კიდევ აქტიურ ჯავშანს (isMine)
        S.firstLoad = false;
        map.sections.forEach((sec) => sec.rows.forEach((r) => r.seats.forEach((st) => { if (st.isMine) S.selection.set(st.id, { seat: st, section: sec.name, ticketType: 'adult' }); })));
      }
    } catch (e) { S.mapState = 'error'; S.mapError = e.message; }
    if (S.step === 1) paint();
  }

  /** 409: ზოგი ადგილი სხვამ დაასწრო. ვაცნობებთ, ვნიშნავთ გაყიდულად, არჩეულიდან ვიღებთ და დანარჩენს ვინარჩუნებთ. */
  function handleContested(err) {
    const lost = err.contested || [];
    lost.forEach((c) => S.soldCodes.add(c));
    [...S.selection].forEach(([id, sel]) => { if (lost.includes(sel.seat.code)) S.selection.delete(id); });
    stopTimer(); S.hold = null; S.step = 1; modal.setDismissible(true);
    S.banner = { type: 'error', text: `${lost.length === 1 ? 'Seat' : 'Seats'} ${lost.join(', ')} ${lost.length === 1 ? 'was' : 'were'} just taken by someone else. Your other seats are still selected.` };
    loadMap();
  }

  // ---- გამოსახვა ------------------------------------------------------------------
  function paint() {
    stepbar.replaceChildren(
      h('button', { type: 'button', class: `step${S.step === 1 ? ' is-active' : ''}`, disabled: S.step === 2 && S.busy || null, onclick: () => { if (S.step === 2 && !S.busy) { S.step = 1; S.banner = null; paint(); } } }, 'SEATS'),
      h('span', { class: `step${S.step === 2 ? ' is-active' : ''}`, 'aria-current': S.step === 2 ? 'step' : null }, 'CHECKOUT'));
    if (S.completed) { stepbar.hidden = true; body.replaceChildren(confirmation()); return; }
    body.replaceChildren(S.step === 1 ? seatStep() : checkoutStep());
  }

  // ზედა შეტყობინება (გაფრთხილება ან შეცდომა)
  function bannerEl() {
    return S.banner ? h('div', { class: `banner banner-${S.banner.type}`, role: 'alert' }, icon('alert', 16), h('span', null, S.banner.text)) : null;
  }

  // ეტაპი 1: ადგილების არჩევა. მარცხნივ რუკა და ლეგენდა, მარჯვნივ არჩეული ადგილები, ბილეთის ტიპები და ჯამი
  function seatStep() {
    if (S.mapState === 'loading') return h('div', { class: 'seat-layout' }, h('div', { class: 'skeleton', style: { height: '420px' } }), h('div', { class: 'skeleton', style: { height: '420px' } }));
    if (S.mapState === 'error') return errorState(S.mapError, loadMap, "Couldn't load the hall map");
    const buttons = new Map();
    const panel = h('div', { class: 'seat-panel' });
    // თუ ადგილი ადრე 409-ით დაიკარგა, რუკის ხელახლა ჩატვირთვამდეც გაყიდულად ვაჩვენებთ
    const stateOf = (st) => (S.soldCodes.has(st.code) && st.state === 'available' ? 'sold' : st.state);

    // რუკის აგება: სექცია -> რიგები -> ადგილები. aisleAfter ამატებს ღიობს, unavailable - ცარიელ უჯრას
    const sections = S.map.sections.map((sec) => {
      const first = sec.rows[0] && sec.rows[0].label, last = sec.rows[sec.rows.length - 1] && sec.rows[sec.rows.length - 1].label;
      return h('div', { class: 'hall-section' },
        h('p', { class: 'hall-section-title' }, `${sec.name.toUpperCase()} · ROWS ${first}${last && last !== first ? `–${last}` : ''}`),
        sec.rows.map((row) => h('div', { class: 'seat-row' }, h('span', { class: 'row-label' }, row.label),
          h('div', { class: 'seats' }, row.seats.flatMap((st) => {
            const s = stateOf(st);
            const out = [];
            if (s === 'unavailable') out.push(h('span', { class: 'seat-gap', 'aria-hidden': 'true' }));
            else {
              const btn = h('button', { type: 'button', class: `seat is-${s}${S.selection.has(st.id) ? ' is-selected' : ''}`, 'aria-pressed': String(S.selection.has(st.id)),
                'aria-label': `Seat ${st.code}, ${S.selection.has(st.id) ? 'selected' : s === 'available' ? 'available' : s === 'held' ? 'held by another user' : 'sold'}`,
                title: s === 'held' ? 'Held by another user' : s === 'sold' ? 'Sold' : st.code, disabled: s === 'sold' || s === 'held' || null, onclick: () => toggleSeat(st, sec.name) }, st.label);
              buttons.set(st.id, btn); out.push(btn);
            }
            if (st.aisleAfter) out.push(h('span', { class: 'aisle', 'aria-hidden': 'true' }));
            return out;
          })))));
    });

    // ადგილის არჩევა/მოხსნა; ლიმიტის გადაჭარბებისას ვაჩვენებთ შეტყობინებას
    function toggleSeat(st, secName) {
      S.notice = '';
      if (S.selection.has(st.id)) S.selection.delete(st.id);
      else if (S.selection.size >= maxSeats()) { S.notice = `You can select up to ${maxSeats()} seats per order.`; }
      else S.selection.set(st.id, { seat: st, section: secName, ticketType: 'adult' });
      S.banner = null;
      buttons.forEach((b, id) => { const on = S.selection.has(id); b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', String(on)); });
      renderPanel();
    }

    // წესების შემოწმება: აკრძალული ბილეთის ტიპი ფილმის ასაკობრივ კატეგორიაზე და ადგილების ლიმიტი. თითოეულ დარღვევაზე ვასახელებთ ადგილს და მიზეზს
    function problems() {
      const out = [];
      S.selection.forEach((sel) => {
        const t = S.options.ticketTypes.find((x) => x.slug === sel.ticketType);
        if (t && t.blockedFromRatingAge != null && movie.ageRating.minAge >= t.blockedFromRatingAge)
          out.push(`Seat ${sel.seat.code}: ${t.name} tickets are not available for ${movie.ageRating.code} films.`);
      });
      if (S.selection.size > maxSeats()) out.push(`You can select up to ${maxSeats()} seats per order.`);
      return out;
    }

    // მარჯვენა პანელი: არჩეული ადგილები, ბილეთის ტიპის არჩევა, Subtotal და Next ღილაკი (გათიშულია, თუ არაფერია არჩეული ან წესი დარღვეულია)
    function renderPanel() {
      const issues = problems();
      const nextBtn = h('button', { type: 'button', class: 'btn btn-red btn-block btn-lg', disabled: S.selection.size === 0 || issues.length > 0 || S.busy || null, 'aria-busy': S.busy ? 'true' : 'false', onclick: goCheckout }, h('span', null, 'Next: Checkout'));
      if (S.busy) nextBtn.classList.add('is-loading');
      panel.replaceChildren(
        h('div', { class: 'panel-top' }, h('h3', null, `Your seats · Max ${maxSeats()}`),
          h('p', { class: 'muted' }, `Pick up to ${maxSeats()} seats from the map. Each seat can carry its own ticket type.`),
          S.notice && h('p', { class: 'seat-notice', role: 'alert' }, S.notice),
          h('ul', { class: 'sel-list' }, [...S.selection.values()].map((sel) => {
            const select = h('select', { 'aria-label': `Ticket type for seat ${sel.seat.code}`, onchange: (e) => { sel.ticketType = e.target.value; renderPanel(); } },
              ticketTypes().map((t) => h('option', { value: t.slug }, t.name)));
            if (!ticketTypes().some((t) => t.slug === sel.ticketType)) { select.append(h('option', { value: sel.ticketType }, sel.ticketType)); }
            select.value = sel.ticketType;
            return h('li', { class: 'sel-item' },
              h('div', { class: 'sel-seat' }, h('b', null, sel.seat.code), h('small', null, sel.section)),
              h('span', { class: 'sel-type' }, select, icon('down', 12)),
              h('b', { class: 'sel-price' }, price(seatPrice(sel))),
              h('button', { type: 'button', class: 'sel-x', 'aria-label': `Remove seat ${sel.seat.code}`, onclick: () => { S.selection.delete(sel.seat.id); S.notice = ''; const b = buttons.get(sel.seat.id); if (b) { b.classList.remove('is-selected'); b.setAttribute('aria-pressed', 'false'); } renderPanel(); } }, icon('close', 12)));
          })),
          issues.length > 0 && h('ul', { class: 'issues', role: 'alert' }, issues.map((i) => h('li', null, i)))),
        h('div', { class: 'panel-bottom' }, h('div', { class: 'subtotal' }, h('span', null, 'SUBTOTAL'), h('b', null, price(subtotal()))), nextBtn));
    }

    // Next: Checkout -> POST holds. წარმატებისას იწყება ტაიმერი; 409-ზე ვუშვებთ handleContested-ს; დაკავებისას ღილაკი გათიშულია
    async function goCheckout() {
      if (S.busy || !S.selection.size) return;
      S.busy = true; modal.setDismissible(false); renderPanel();
      try {
        const hold = await api.hold(session.id, [...S.selection.values()].map((s) => ({ seatId: s.seat.id, ticketType: s.ticketType })));
        S.hold = hold; S.step = 2; S.banner = null; S.busy = false; modal.setDismissible(true);
        startTimer(hold); paint();
      } catch (e) {
        S.busy = false; modal.setDismissible(true);
        if (e.status === 409) { handleContested(e); return; }
        if (e.status === 401) { renderPanel(); return; } // შესვლა გაუქმდა
        const first = e.errors && Object.values(e.errors)[0];
        S.banner = { type: 'error', text: (Array.isArray(first) ? first[0] : null) || e.message };
        paint();
      }
    }

    renderPanel();
    return h('div', null, bannerEl(),
      h('div', { class: 'seat-layout' },
        h('div', { class: 'hall' },
          h('div', { class: 'screen' }, 'SCREEN'), h('div', { class: 'hall-sections' }, sections),
          h('ul', { class: 'legend' },
            [['available', 'Available'], ['is-selected', 'Selected'], ['sold', 'Sold'], ['held', 'Held by another user']].map(([c, l]) => h('li', null, h('span', { class: `seat seat-legend is-${c.replace('is-', '')}` }), l)))),
        panel));
  }

  // ეტაპი 2: მყიდველისა და ბარათის ფორმა + შეკვეთის შეჯამება (ფასები სერვერის ჯავშნის პასუხიდან)
  function checkoutStep() {
    const hold = S.hold, user = getUser();
    const fullName = createField({ label: 'Full name', name: 'fullName', value: user.fullName || '', autocomplete: 'name',
      validate: (v) => (!v.trim() ? 'Name is required' : v.trim().length < 3 ? 'Name must be at least 3 characters' : v.trim().length > 50 ? 'Name must not exceed 50 characters' : '') });
    const email = createField({ label: 'Email', name: 'email', type: 'email', value: user.email || '', autocomplete: 'email', validate: validators.email });
    const mobile = createField({ label: 'Mobile number', name: 'mobileNumber', type: 'tel', value: user.mobileNumber || '', placeholder: '5XX XXX XXX', autocomplete: 'tel-national', validate: validateMobile });
    const card = createField({ label: 'Card number', name: 'cardNumber', placeholder: '1234 5678 9012 3456', inputmode: 'numeric', autocomplete: 'cc-number', maxlength: 19,
      format: (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(),
      validate: (v) => (!v.trim() ? 'Card number is required' : v.replace(/\s/g, '').length !== 16 ? 'Card number must be 16 digits' : '') });
    const expiry = createField({ label: 'Expiry', name: 'expiry', placeholder: 'MM/YY', inputmode: 'numeric', autocomplete: 'cc-exp', maxlength: 5,
      format: (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; },
      validate: (v) => {
        if (!v) return 'Expiry date is required';
        const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);
        if (!m) return 'Use the format MM/YY';
        const now = new Date();
        return new Date(2000 + Number(m[2]), Number(m[1]), 1) <= new Date(now.getFullYear(), now.getMonth(), 1) ? 'Card has expired' : '';
      } });
    const cvv = createField({ label: 'CVV', name: 'cvv', type: 'password', placeholder: '•••', inputmode: 'numeric', autocomplete: 'cc-csc', maxlength: 3,
      format: (v) => v.replace(/\D/g, '').slice(0, 3), validate: (v) => (!v ? 'CVV is required' : v.length !== 3 ? 'CVV must be 3 digits' : '') });
    // ველები სახელებით, რომლებიც API-ს 422 პასუხის ველებს ემთხვევა - სერვერის შეცდომები ავტომატურად მიებმება სწორ ველს
    const fields = { fullName, email, mobileNumber: mobile, cardNumber: card, expiry, cvv };
    const formError = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const pay = h('button', { type: 'submit', class: 'btn btn-red btn-lg', 'aria-busy': 'false' }, h('span', null, 'Pay & Complete Order'));
    const back = h('button', { type: 'button', class: 'btn btn-ghost btn-lg', onclick: () => { if (S.busy) return; S.step = 1; S.banner = null; paint(); } }, 'Back to seats');
    // გადახდის დროს ღილაკები გათიშულია, მოდალის დახურვა დაბლოკილია
    const setBusy = (on) => { S.busy = on; pay.disabled = on; back.disabled = on; pay.classList.toggle('is-loading', on); pay.setAttribute('aria-busy', String(on)); modal.setDismissible(!on); };

    // გადახდის გაგზავნა: ვალიდაცია -> POST /orders. 422 ველებზე, 409 ადგილებზე, დანარჩენი ფორმის შეცდომად
    const form = h('form', { class: 'checkout-form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      if (S.busy) return; // იცავს ორმაგი გაგზავნისგან
      formError.hidden = true;
      if (!Object.values(fields).map((f) => f.touch()).every(Boolean)) return;
      setBusy(true);
      try {
        const order = await api.order({ holdId: hold.holdId, fullName: fullName.value.trim(), email: email.value.trim(), mobileNumber: mobile.value.replace(/\s/g, ''),
          cardNumber: card.value.replace(/\s/g, ''), expiry: expiry.value, cvv: cvv.value });
        S.completed = true; S.order = order; stopTimer(); setBusy(false); paint();
      } catch (err) {
        setBusy(false);
        if (err.status === 422 && err.errors) {
          const rest = applyServerErrors(err.errors, fields);
          if (rest.length) { formError.textContent = rest[0]; formError.hidden = false; }
        } else if (err.status === 422) expire(err.message || 'Your hold time expired. Please re-select your seats.'); // ეს წესის შეცდომაა და არა ველის: ჯავშნის დრო გავიდა
        else if (err.status === 409) handleContested(err);
        else if (err.status !== 401) { formError.textContent = err.message; formError.hidden = false; }
      }
    } },
      formError, h('h3', { class: 'co-h' }, 'Buyer details'), fullName.el, email.el, mobile.el,
      h('h3', { class: 'co-h' }, 'Payment'), card.el, h('div', { class: 'field-row' }, expiry.el, cvv.el),
      h('div', { class: 'co-actions' }, back, pay));

    const summary = h('aside', { class: 'summary' }, h('h3', null, 'Order summary'),
      h('ul', { class: 'sum-list' }, hold.seats.map((s) => h('li', null, h('span', null, h('b', null, s.code), h('small', null, s.ticketType.name)), h('b', null, price(s.price))))),
      h('div', { class: 'subtotal total' }, h('span', null, 'TOTAL'), h('b', null, price(hold.subtotal))),
      h('p', { class: 'muted' }, 'Payment is simulated: any 16-digit card with a future expiry works.'));
    return h('div', null, bannerEl(), h('div', { class: 'checkout-layout' }, form, summary));
  }

  // დადასტურების ხედი: შეკვეთის კოდი, ბილეთები, ჯამი, ღილაკები My Tickets / Close
  function confirmation() {
    const o = S.order, s = o.session || session;
    return h('div', { class: 'confirm' },
      h('span', { class: 'confirm-ico' }, icon('check', 28)),
      h('h2', null, 'Order confirmed!'), h('p', { class: 'muted' }, 'Your tickets are booked. Show the code below at the cinema.'),
      h('div', { class: 'ref' }, h('small', null, 'ORDER REFERENCE'), h('b', null, o.reference)),
      h('div', { class: 'confirm-card' },
        h('p', null, h('b', null, movie.title), ` · ${s.venue.name} · Hall ${s.hall.name}`),
        h('p', { class: 'muted' }, `${longDate(s.date)} · ${s.time} · ${s.format.name} · ${s.language.name}`),
        h('ul', { class: 'sum-list' }, o.tickets.map((t) => h('li', null, h('span', null, h('b', null, t.seatCode), h('small', null, t.ticketType.name)), h('b', null, price(t.price))))),
        h('div', { class: 'subtotal total' }, h('span', null, 'TOTAL PAID'), h('b', null, price(o.totalPrice))),
        o.cardLastFour && h('p', { class: 'muted' }, `Paid with card ending ${o.cardLastFour}`)),
      h('div', { class: 'modal-actions center' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close('done') }, 'Close'),
        h('button', { type: 'button', class: 'btn btn-red', onclick: () => { modal.close('tickets'); navigate('/profile?tab=tickets'); } }, 'My Tickets')));
  }

  paint();
  loadMap();
}

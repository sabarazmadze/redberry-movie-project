import { h, icon, img } from '../dom.js';
import { api, isAbort } from '../api.js';
import { nextDays, fullDate, price } from '../format.js';
import { addRecent } from '../recent.js';
import { subscribe, isAgeBlocked, ageBlockMessage } from '../auth.js';
import { startBooking } from '../components/session-card.js';
import { ageBadge, errorState, notifyButton } from '../components/cards.js';
import { navigate } from '../router.js';

export function mount(root, ctx) {
  const slug = ctx.params.slug;
  let movie = null;
  let date = null;
  let controller = null;
  let renderSessions = () => {};

  const view = h('div', { class: 'movie-page' });
  root.append(view);

  async function load() {
    view.replaceChildren(h('div', { class: 'movie-hero skeleton', style: { borderRadius: 0 } }), h('div', { class: 'movie-body' }, h('div', { class: 'skeleton', style: { height: '300px' } })));
    try { movie = await api.movie(slug); }
    catch (e) {
      view.replaceChildren(h('div', { class: 'movie-hero' }), h('div', { class: 'movie-body' }, e.status === 404
        ? h('div', { class: 'state' }, h('span', { class: 'ico' }, icon('film', 22)), h('h3', null, 'Film not found'), h('p', null, "This title doesn't exist or is no longer listed."), h('a', { class: 'btn btn-red', href: '/sessions' }, 'Browse sessions'))
        : errorState(e.message, load, "Couldn't load this film")));
      return;
    }
    document.title = `${movie.title} · Kino XII`;
    addRecent(movie);
    build();
  }

  function build() {
    const dates = nextDays(7);
    const available = new Set(movie.availableDates || []);
    date = (ctx.query.get('date') && dates.find((d) => d.ymd === ctx.query.get('date')) && ctx.query.get('date')) || (dates.find((d) => available.has(d.ymd)) || dates[0]).ymd;

    const hero = h('section', { class: 'movie-hero' },
      img(movie.backdropUrl || movie.posterUrl, '', 'movie-bg'),
      h('div', { class: 'movie-hero-inner' },
        h('div', { class: 'movie-poster' }, img(movie.posterUrl, `${movie.title} poster`, '')),
        h('div', { class: 'movie-intro' },
          h('span', { class: `badge badge-lg ${movie.isComingSoon ? 'badge-amber' : 'badge-red'}` }, movie.isComingSoon ? 'COMING SOON' : 'NOW PLAYING'),
          h('h1', null, movie.title.toUpperCase()),
          h('p', { class: 'movie-syn' }, movie.synopsis),
          h('div', { class: 'hero-meta' }, ageBadge(movie, 'badge-lg'),
            h('span', { class: 'badge' }, icon('timer', 14), `${movie.runtimeMinutes} Min`),
            (movie.genres || []).map((g) => h('span', { class: 'badge' }, g.name)),
            (movie.formats || []).map((f) => h('span', { class: 'badge' }, f.name))))));

    const sessionsBox = h('div', { class: 'ms-list' });
    const note = h('div');
    const chips = h('div', { class: 'date-row ms-dates', role: 'group', 'aria-label': 'Choose a date' }, dates.map((d) =>
      h('button', { type: 'button', class: `ms-chip${d.ymd === date ? ' is-selected' : ''}`, dataset: { ymd: d.ymd }, disabled: !movie.isComingSoon && !available.has(d.ymd) || null, 'aria-pressed': String(d.ymd === date),
        onclick: () => pick(d.ymd) }, h('span', null, d.dow), h('b', null, d.day))));

    function pick(ymd) {
      date = ymd;
      chips.querySelectorAll('.ms-chip').forEach((c) => { const on = c.dataset.ymd === ymd; c.classList.toggle('is-selected', on); c.setAttribute('aria-pressed', String(on)); });
      history.replaceState(null, '', `${location.pathname}?date=${ymd}`);
      loadSessions();
    }

    let groups = null;
    async function loadSessions() {
      if (controller) controller.abort();
      controller = new AbortController();
      const mine = controller;
      sessionsBox.replaceChildren(...[0, 1].map(() => h('div', { class: 'skeleton', style: { height: '120px', borderRadius: '16px' } })));
      try {
        groups = await api.movieSessions(slug, date, mine.signal);
        if (!mine.signal.aborted) renderSessions();
      } catch (e) {
        if (isAbort(e)) return;
        sessionsBox.replaceChildren(errorState(e.message, loadSessions, "Couldn't load sessions"));
      }
    }

    renderSessions = () => {
      const blocked = isAgeBlocked(movie);
      note.replaceChildren(blocked ? h('div', { class: 'form-notice', role: 'alert' }, icon('alert', 16), h('span', null, ageBlockMessage(movie))) : '');
      if (!groups) return;
      const total = groups.reduce((n, g) => n + g.sessions.length, 0);
      if (!total) {
        sessionsBox.replaceChildren(h('div', { class: 'state' }, h('span', { class: 'ico' }, icon('calendar', 22)), h('h3', null, 'No sessions on this date'), h('p', null, 'Pick another day above to see showtimes for this film.')));
        return;
      }
      sessionsBox.replaceChildren(...groups.map(({ venue, sessions }) => {
        const halls = new Map();
        sessions.forEach((s) => { if (!halls.has(s.hall.name)) halls.set(s.hall.name, []); halls.get(s.hall.name).push(s); });
        return h('section', { class: 'venue-block' }, h('h3', null, venue.name),
          h('div', { class: 'hall-row' }, [...halls].map(([hall, list]) => h('div', { class: 'hall-box' }, h('p', { class: 'hall-name' }, `Hall ${hall}`),
            h('div', { class: 'tickets' }, list.map((s) => ticket(s)))))));
      }));
    };

    function ticket(s) {
      const disabled = s.isSoldOut || isAgeBlocked(movie);
      return h('button', { type: 'button', class: 'ticket', disabled: disabled || null, title: isAgeBlocked(movie) ? ageBlockMessage(movie) : s.isSoldOut ? 'Sold out' : 'Select seats',
        'aria-label': `${s.time}, ${s.format.name}, ${s.language.name}, ${s.isSoldOut ? 'sold out' : s.seatsLeft + ' seats left'}`, onclick: () => startBooking(s, movie) },
        h('span', { class: 'ticket-main' }, h('b', null, s.time), h('span', { class: 'ticket-sub' }, h('small', null, s.language.code), h('span', { class: 'badge badge-dark' }, s.format.name))),
        h('span', { class: 'ticket-stub' }, h('b', null, price(s.price)), h('small', null, icon('ticket', 11), s.isSoldOut ? 'Sold out' : `${s.seatsLeft} left`)));
    }

    const detail = (label, value) => value ? h('div', { class: 'detail' }, h('dt', null, label), h('dd', null, value)) : null;
    const r = movie.ageRating;
    const details = h('aside', { class: 'details' }, h('h2', null, 'Details'),
      h('dl', null,
        detail('Director', movie.director), detail('Main cast', movie.cast), detail('Duration', `${movie.runtimeMinutes} minutes`),
        detail('Release date', fullDate(movie.releaseDate)), detail('Genre', (movie.genres || []).map((g) => g.name).join(', ')),
        detail('Formats', (movie.formats || []).map((f) => f.name).join(', ')),
        !movie.isComingSoon && detail('From', price(movie.fromPrice))),
      r && r.minAge >= 12 && h('div', { class: 'rating-note' }, h('b', null, 'RATING NOTE'), h('p', null, h('strong', null, r.code), ' ', r.description)));

    const left = movie.isComingSoon
      ? h('section', { class: 'ms' }, h('h2', null, 'Sessions'), h('div', { class: 'state' }, h('span', { class: 'ico' }, icon('calendar', 22)), h('h3', null, 'Not in cinemas yet'),
          h('p', null, `Sessions open closer to the release on ${fullDate(movie.releaseDate)}. We can let you know.`), notifyButton(movie)))
      : h('section', { class: 'ms' }, h('h2', null, 'Sessions'), chips, note, sessionsBox);

    view.replaceChildren(hero, h('div', { class: 'movie-body' }, left, details));
    if (!movie.isComingSoon) loadSessions();
  }

  load();
  const unsub = subscribe(() => renderSessions());
  return { destroy: () => { unsub(); if (controller) controller.abort(); document.title = 'Kino XII'; } };
}

import { h, icon, img } from '../dom.js';
import { api } from '../api.js';
import { dayMonth, price } from '../format.js';
import { requireAuth } from '../modals/auth.js';
import { toast } from './toast.js';

export const genreLine = (m) => [m.genres && m.genres[0] && m.genres[0].name, `${m.runtimeMinutes} min`].filter(Boolean).join(' · ');

export function ageBadge(movie, extra = '') {
  const r = movie.ageRating;
  if (!r) return null;
  return h('span', { class: `badge badge-red ${extra}`.trim(), title: r.description || '' }, r.code);
}

/** Large Now Playing card (design: Card_big). */
export function bigCard(movie) {
  const href = `/movies/${movie.slug}`;
  return h('article', { class: 'card-big' },
    h('a', { class: 'card-big-poster', href, 'aria-label': `${movie.title} details`, tabindex: '-1' }, img(movie.posterUrl, `${movie.title} poster`, '')),
    h('div', { class: 'card-big-info' },
      h('a', { class: 'card-big-title', href }, movie.title),
      h('p', { class: 'muted' }, genreLine(movie)),
      ageBadge(movie)),
    h('div', { class: 'card-big-foot' },
      h('span', { class: 'from' }, `From ${price(movie.fromPrice)}`),
      h('a', { class: 'btn btn-red btn-sm', href }, 'Buy Ticket')));
}

/** Notify-me button: guests are asked to log in first, then the subscription goes through. */
export function notifyButton(movie) {
  const btn = h('button', { type: 'button', class: 'btn btn-outline' }, icon('bell', 14), h('span', null, 'Notify Me'));
  let busy = false;
  btn.addEventListener('click', () => requireAuth(async () => {
    if (busy) return;
    busy = true; btn.disabled = true;
    try {
      await api.notify(movie.slug);
      btn.replaceChildren(icon('check', 14), h('span', null, "We'll notify you"));
      btn.classList.add('is-done');
      toast(`We'll let you know when ${movie.title} opens.`, { type: 'success' });
    } catch (e) {
      if (e.status !== 401) toast(e.message, { type: 'error' });
      busy = false; btn.disabled = false;
    }
  }));
  return btn;
}

/** Coming Soon card (design: Card_medium). Deliberately not a link into seat selection. */
export function comingSoonCard(movie) {
  return h('article', { class: 'card-medium' },
    h('div', { class: 'card-medium-poster' }, img(movie.posterUrl, `${movie.title} poster`, '')),
    h('div', { class: 'card-medium-info' },
      h('div', { class: 'stack' },
        h('p', { class: 'overline-red' }, `IN CINEMAS ${dayMonth(movie.releaseDate)}`),
        h('h3', { class: 'card-medium-title' }, movie.title),
        h('p', { class: 'muted' }, genreLine(movie)),
        ageBadge(movie)),
      notifyButton(movie)));
}

/** Compact "recently viewed" card. */
export function recentCard(movie) {
  return h('a', { class: 'card-medium card-recent', href: `/movies/${movie.slug}` },
    h('div', { class: 'card-medium-poster' }, img(movie.posterUrl || movie.backdropUrl, `${movie.title} poster`, '')),
    h('div', { class: 'card-medium-info' },
      h('div', { class: 'stack' },
        h('h3', { class: 'card-medium-title' }, movie.title.toUpperCase()),
        h('p', { class: 'muted' }, genreLine(movie)),
        ageBadge(movie))));
}

export function bigCardSkeleton() { return h('div', { class: 'card-big skeleton', 'aria-hidden': 'true' }); }
export function mediumCardSkeleton() { return h('div', { class: 'card-medium skeleton', 'aria-hidden': 'true' }); }

/** Error block with a Retry button (used wherever a request fails). */
export function errorState(message, onRetry, title = 'Something went wrong') {
  return h('div', { class: 'state is-error', role: 'alert' },
    h('span', { class: 'ico' }, icon('alert', 22)), h('h3', null, title), h('p', null, message),
    onRetry && h('button', { type: 'button', class: 'btn btn-red', onclick: onRetry }, 'Try again'));
}

export function emptyState({ title, message, actionLabel, onAction, href, iconName = 'film' }) {
  return h('div', { class: 'state' },
    h('span', { class: 'ico' }, icon(iconName, 22)), h('h3', null, title), message && h('p', null, message),
    actionLabel && (href
      ? h('a', { class: 'btn btn-red', href }, actionLabel)
      : h('button', { type: 'button', class: 'btn btn-red', onclick: onAction }, actionLabel)));
}

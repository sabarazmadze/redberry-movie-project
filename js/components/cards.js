import { h, icon, img } from '../dom.js';
import { api } from '../api.js';
import { dayMonth, price } from '../format.js';
import { requireAuth } from '../modals/auth.js';
import { toast } from './toast.js';

// ქვესათაური: პირველი ჟანრი + ხანგრძლივობა
export const genreLine = (m) => [m.genres && m.genres[0] && m.genres[0].name, `${m.runtimeMinutes} min`].filter(Boolean).join(' · ');

// ასაკობრივი შეზღუდვის ნიშნული (G / PG / 12+ / 16+ / 18+); hover-ზე ჩანს განმარტება
export function ageBadge(movie, extra = '') {
  const r = movie.ageRating;
  if (!r) return null;
  return h('span', { class: `badge badge-red ${extra}`.trim(), title: r.description || '' }, r.code);
}

/** დიდი "ახლა ეკრანებზე" ბარათი (დიზაინი: Card_big). */
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

/** "შემატყობინე" ღილაკი: სტუმარს ჯერ შესვლას სთხოვს, შემდეგ ხდება გამოწერა. */
export function notifyButton(movie) {
  const btn = h('button', { type: 'button', class: 'btn btn-outline' }, icon('bell', 14), h('span', null, 'Notify Me'));
  // busy იცავს განმეორებითი დაწკაპუნებისგან - მოთხოვნა ერთხელ გაიგზავნება
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

/** "მალე კინოში" ბარათი (დიზაინი: Card_medium). განზრახ არ არის ბმული - სეანსები არ აქვს, ადგილების არჩევაზე არ გადადის. */
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

/** კომპაქტური "ბოლოს ნანახი" ბარათი. */
export function recentCard(movie) {
  return h('a', { class: 'card-medium card-recent', href: `/movies/${movie.slug}` },
    h('div', { class: 'card-medium-poster' }, img(movie.posterUrl || movie.backdropUrl, `${movie.title} poster`, '')),
    h('div', { class: 'card-medium-info' },
      h('div', { class: 'stack' },
        h('h3', { class: 'card-medium-title' }, movie.title.toUpperCase()),
        h('p', { class: 'muted' }, genreLine(movie)),
        ageBadge(movie))));
}

// ჩატვირთვის სკელეტონები (ცარიელი ეკრანისა და სპინერის ნაცვლად)
export function bigCardSkeleton() { return h('div', { class: 'card-big skeleton', 'aria-hidden': 'true' }); }
export function mediumCardSkeleton() { return h('div', { class: 'card-medium skeleton', 'aria-hidden': 'true' }); }

/** შეცდომის ბლოკი "ხელახლა ცდის" ღილაკით (გამოიყენება ყველგან, სადაც მოთხოვნა ჩავარდება). */
export function errorState(message, onRetry, title = 'Something went wrong') {
  return h('div', { class: 'state is-error', role: 'alert' },
    h('span', { class: 'ico' }, icon('alert', 22)), h('h3', null, title), h('p', null, message),
    onRetry && h('button', { type: 'button', class: 'btn btn-red', onclick: onRetry }, 'Try again'));
}

// ცარიელი სტატუსი: განმარტება და, სადაც გონივრულია, გამოსავლის ღილაკი
export function emptyState({ title, message, actionLabel, onAction, href, iconName = 'film' }) {
  return h('div', { class: 'state' },
    h('span', { class: 'ico' }, icon(iconName, 22)), h('h3', null, title), message && h('p', null, message),
    actionLabel && (href
      ? h('a', { class: 'btn btn-red', href }, actionLabel)
      : h('button', { type: 'button', class: 'btn btn-red', onclick: onAction }, actionLabel)));
}

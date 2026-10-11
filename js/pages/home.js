import { h, icon, img } from '../dom.js';
import { api } from '../api.js';
import { price } from '../format.js';
import { getRecent } from '../recent.js';
import { scroller } from '../components/scroller.js';
import { ageBadge, bigCard, bigCardSkeleton, comingSoonCard, mediumCardSkeleton, recentCard, errorState, emptyState } from '../components/cards.js';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mount(root) {
  const hero = h('section', { class: 'hero', 'aria-label': 'Featured films' });
  const content = h('div', { class: 'home-sections' });
  root.append(hero, content);

  let destroyHero = () => {};
  const loadHero = async () => {
    destroyHero();
    hero.replaceChildren(h('div', { class: 'hero-skeleton skeleton' }));
    try {
      const films = await api.featured();
      if (!films.length) {
        hero.replaceChildren(h('div', { class: 'hero-empty' }, emptyState({ title: 'No featured films right now', message: 'Check the full list of showtimes instead.', actionLabel: 'Browse sessions', href: '/sessions' })));
        return;
      }
      destroyHero = buildHero(hero, films.slice(0, 4));
    } catch (e) {
      hero.replaceChildren(h('div', { class: 'hero-empty' }, errorState(e.message, loadHero)));
    }
  };

  // recently viewed (local, so it never needs a request)
  const recent = getRecent();
  if (recent.length) {
    content.append(h('section', { class: 'section', 'aria-labelledby': 'recent-h' },
      h('div', { class: 'section-head' }, h('h2', { id: 'recent-h' }, 'Recently viewed')),
      h('div', { class: 'row row-recent' }, recent.slice(0, 4).map(recentCard))));
    content.append(h('hr', { class: 'rule' }));
  }

  const nowBody = h('div', { class: 'row' });
  const nowRow = scroller(nowBody);
  content.append(h('section', { class: 'section', 'aria-labelledby': 'now-h' },
    h('div', { class: 'section-head' }, h('h2', { id: 'now-h' }, 'NOW PLAYING'), h('div', { class: 'section-tools' }, nowRow.arrows, h('a', { class: 'see-all', href: '/sessions' }, 'See all'))), nowRow.el));
  content.append(h('hr', { class: 'rule' }));

  const soonBody = h('div', { class: 'row' });
  const soonRow = scroller(soonBody);
  content.append(h('section', { class: 'section', 'aria-labelledby': 'soon-h' },
    h('div', { class: 'section-head' }, h('h2', { id: 'soon-h' }, 'COMING SOON...'), h('div', { class: 'section-tools' }, soonRow.arrows, h('a', { class: 'see-all', href: '/sessions' }, 'See all'))), soonRow.el));

  const loadNow = async () => {
    nowBody.replaceChildren(...Array.from({ length: 6 }, bigCardSkeleton));
    try {
      const films = await api.nowPlaying();
      if (!films.length) nowBody.replaceChildren(emptyState({ title: 'Nothing is playing right now', message: 'New films arrive every week.' }));
      else nowBody.replaceChildren(...films.map(bigCard));
    } catch (e) { nowBody.replaceChildren(errorState(e.message, loadNow, "Couldn't load films")); }
    nowRow.refresh();
  };
  const loadSoon = async () => {
    soonBody.replaceChildren(...Array.from({ length: 4 }, mediumCardSkeleton));
    try {
      const films = await api.comingSoon();
      if (!films.length) soonBody.replaceChildren(emptyState({ title: 'No upcoming releases yet', message: 'Check back soon for new announcements.' }));
      else soonBody.replaceChildren(...films.map(comingSoonCard));
    } catch (e) { soonBody.replaceChildren(errorState(e.message, loadSoon, "Couldn't load upcoming films")); }
    soonRow.refresh();
  };

  loadHero(); loadNow(); loadSoon();
  return { destroy: () => destroyHero() };
}

function buildHero(container, films) {
  let index = 0;
  const auto = !reducedMotion();

  const slides = films.map((m, i) => h('div', { class: 'hero-slide', 'aria-hidden': i === 0 ? 'false' : 'true', 'aria-roledescription': 'slide' },
    img(m.backdropUrl || m.posterUrl, '', 'hero-bg'),
    h('div', { class: 'hero-copy' },
      h('span', { class: 'badge badge-red badge-lg' }, `NOW PLAYING · FROM ${price(m.fromPrice)}`),
      h('h1', { class: 'hero-title' }, m.title.toUpperCase()),
      h('div', { class: 'hero-meta' },
        ageBadge(m, 'badge-lg'),
        h('span', { class: 'badge' }, icon('timer', 14), `${m.runtimeMinutes} Min`),
        (m.formats || []).map((f) => h('span', { class: 'badge' }, f.name))),
      h('p', { class: 'hero-synopsis' }, m.synopsis || ''),
      h('div', { class: 'hero-actions' },
        h('a', { class: 'btn btn-red', href: `/movies/${m.slug}` }, icon('ticket', 16), 'Buy tickets'),
        h('a', { class: 'btn btn-ghost', href: '/sessions' }, 'All sessions')))));

  const bars = films.map((m, i) => h('button', { type: 'button', class: 'hero-bar', 'aria-label': `Show ${m.title}`, onclick: () => go(i) }, h('span', { class: 'fill' })));
  const prev = h('button', { type: 'button', class: 'round-btn round-lg', 'aria-label': 'Previous film', onclick: () => go(index - 1) }, icon('left', 22));
  const next = h('button', { type: 'button', class: 'round-btn round-lg', 'aria-label': 'Next film', onclick: () => go(index + 1) }, icon('right', 22));
  const controls = h('div', { class: 'hero-controls' }, h('div', { class: 'hero-bars' }, bars), h('div', { class: 'hero-arrows' }, prev, next));
  container.replaceChildren(...slides, controls);
  container.classList.toggle('is-static', !auto);

  function paint() {
    slides.forEach((s, i) => { s.classList.toggle('is-active', i === index); s.setAttribute('aria-hidden', String(i !== index)); s.querySelectorAll('a').forEach((a) => { a.tabIndex = i === index ? 0 : -1; }); });
    bars.forEach((b, i) => {
      b.classList.toggle('is-active', i === index);
      b.classList.toggle('is-done', i < index);
      // restart the fill animation on the active bar
      const fill = b.firstChild;
      fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = '';
    });
  }
  function go(i) { index = (i + films.length) % films.length; paint(); }

  // The progress bar's CSS animation is the clock: when it ends, advance. Hovering/focusing the hero pauses
  // the animation (see CSS), so the timing and the visual can never drift apart.
  if (auto) bars.forEach((b, i) => b.firstChild.addEventListener('animationend', () => { if (i === index) go(index + 1); }));

  paint();
  return () => {};
}

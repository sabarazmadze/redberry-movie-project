import { h, icon } from '../dom.js';

/** Horizontal scroller with a fade on the clipped edge and prev / next arrows. */
export function scroller(row) {
  const wrap = h('div', { class: 'scroller fade-end' }, row);
  const step = () => Math.max(300, wrap.clientWidth * 0.8);
  const prev = h('button', { type: 'button', class: 'round-btn', 'aria-label': 'Scroll left', onclick: () => wrap.scrollBy({ left: -step(), behavior: 'smooth' }) }, icon('left', 18));
  const next = h('button', { type: 'button', class: 'round-btn', 'aria-label': 'Scroll right', onclick: () => wrap.scrollBy({ left: step(), behavior: 'smooth' }) }, icon('right', 18));
  const refresh = () => {
    const max = wrap.scrollWidth - wrap.clientWidth;
    wrap.classList.toggle('fade-end', wrap.scrollLeft < max - 4);
    wrap.classList.toggle('fade-start', wrap.scrollLeft > 4);
    prev.disabled = wrap.scrollLeft <= 4;
    next.disabled = wrap.scrollLeft >= max - 4;
    const scrollable = max > 4;
    prev.hidden = next.hidden = !scrollable;
  };
  wrap.addEventListener('scroll', refresh, { passive: true });
  window.addEventListener('resize', refresh);
  return { el: wrap, arrows: h('div', { class: 'arrows' }, prev, next), refresh };
}

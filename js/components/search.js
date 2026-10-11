import { h, icon, img, debounce } from '../dom.js';
import { api, isAbort } from '../api.js';
import { navigate } from '../router.js';
import { price } from '../format.js';

export function createSearch() {
  const input = h('input', { type: 'search', placeholder: 'Search films and live events', 'aria-label': 'Search films and live events', autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'search-panel' });
  const clearBtn = h('button', { type: 'button', class: 'search-clear', 'aria-label': 'Clear search', hidden: true, onclick: () => { input.value = ''; clearBtn.hidden = true; show('prompt'); input.focus(); } }, icon('close', 10));
  const panel = h('div', { class: 'search-panel', id: 'search-panel', role: 'listbox', hidden: true });
  const el = h('div', { class: 'search' }, h('div', { class: 'search-box' }, icon('search', 14), input, clearBtn), panel);

  let controller = null;
  let items = [];
  let activeIndex = -1;

  const browseBtn = () => h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { close(); navigate('/sessions'); } }, 'Browse all sessions');

  function open() { panel.hidden = false; input.setAttribute('aria-expanded', 'true'); }
  function close() { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); activeIndex = -1; if (controller) controller.abort(); }

  function show(state, data) {
    open();
    items = [];
    activeIndex = -1;
    if (state === 'prompt') {
      panel.replaceChildren(h('div', { class: 'search-state' }, h('span', { class: 'ico' }, icon('film', 18)),
        h('strong', null, 'What do you want to watch?'), h('p', null, 'Search by title, director or cast'), browseBtn()));
    } else if (state === 'loading') {
      panel.replaceChildren(h('div', { style: { padding: '14px 16px', display: 'grid', gap: '10px' } },
        [0, 1, 2].map(() => h('div', { class: 'skeleton', style: { height: '42px', borderRadius: '8px' } }))));
    } else if (state === 'error') {
      panel.replaceChildren(h('div', { class: 'search-state' }, h('strong', null, 'Search failed'), h('p', null, data),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => run(input.value.trim()) }, 'Try again')));
    } else if (state === 'none') {
      panel.replaceChildren(h('div', { class: 'search-state' }, h('span', { class: 'ico' }, icon('search', 18)),
        h('strong', null, `No results for “${data}”`), h('p', null, 'Check the spelling or try another film or live event.'), browseBtn()));
    } else if (state === 'results') {
      items = data.map((m) => h('button', { type: 'button', class: 'search-item', role: 'option', onclick: () => { close(); input.blur(); navigate(`/movies/${m.slug}`); } },
        img(m.posterUrl, '', ''),
        h('span', { class: 't' }, h('b', null, m.title), h('small', null, `${m.kind === 'event' ? 'Event' : 'Film'} · ${m.ageRating ? m.ageRating.code : ''} · ${m.runtimeMinutes} min`)),
        m.isComingSoon ? h('span', { class: 'p soon' }, 'Coming Soon') : h('span', { class: 'p' }, `from ${price(m.fromPrice)}`)));
      panel.replaceChildren(h('div', { class: 'search-meta' }, h('span', null, 'Films & events'), h('span', null, `${data.length} result${data.length === 1 ? '' : 's'}`)), ...items);
    }
  }

  async function run(q) {
    if (controller) controller.abort();
    if (!q) { show('prompt'); return; }
    controller = new AbortController();
    show('loading');
    try {
      const results = await api.search(q, controller.signal);
      show(results.length ? 'results' : 'none', results.length ? results : q);
    } catch (e) {
      if (isAbort(e)) return;
      show('error', e.message);
    }
  }

  const debounced = debounce((q) => run(q), 300);
  input.addEventListener('focus', () => { if (!input.value.trim()) show('prompt'); else open(); });
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.hidden = !input.value;
    if (!q) { debounced.cancel(); run(''); return; }
    debounced(q);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); input.blur(); }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
      e.preventDefault();
      activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((n, i) => n.classList.toggle('is-active', i === activeIndex));
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); items[activeIndex].click(); }
  });
  document.addEventListener('mousedown', (e) => { if (!el.contains(e.target)) close(); });
  return { el, close };
}

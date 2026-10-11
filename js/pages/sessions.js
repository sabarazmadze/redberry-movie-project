import { h, icon, img } from '../dom.js';
import { api, isAbort } from '../api.js';
import { getOptions } from '../meta.js';
import { navigate } from '../router.js';
import { nextDays, todayYmd } from '../format.js';
import { subscribe, isAgeBlocked, ageBlockMessage } from '../auth.js';
import { scroller } from '../components/scroller.js';
import { sessionCard } from '../components/session-card.js';
import { ageBadge, errorState, emptyState } from '../components/cards.js';

// სიის ტიპის ფილტრები URL-ში მძიმით გამოყოფილი მნიშვნელობებით (venue=a,b)
const LIST_KEYS = ['venue', 'format', 'language', 'time'];
// "a,b" -> ['a','b'] (ცარიელი ელემენტების გარეშე)
const csv = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);

/** URL <-> მდგომარეობა. ყველაფერი, რასაც გვერდი აჩვენებს, query სტრიქონიდან გამოითვლება (დავალების სავალდებულო მოთხოვნა). */
function readState(query, options) {
  const valid = (key, list) => { const ok = new Set(list.map((o) => o.slug || o.id)); return csv(query.get(key)).filter((x) => ok.has(x)); };
  const sortIds = options.sorts.map((s) => s.id);
  const dates = nextDays(7).map((d) => d.ymd);
  const date = query.get('date');
  const page = parseInt(query.get('page'), 10);
  return {
    venue: valid('venue', options.venues), format: valid('format', options.formats), language: valid('language', options.languages),
    time: valid('time', options.timeBands),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dates[0],
    sort: sortIds.includes(query.get('sort')) ? query.get('sort') : sortIds[0] || 'time_asc',
    page: page > 0 ? page : 1,
  };
}
// მდგომარეობა -> URL; ნაგულისხმევ სორტირებას და 1-ელ გვერდს URL-ში არ ვწერთ
function toUrl(state, options) {
  const p = new URLSearchParams();
  LIST_KEYS.forEach((k) => { if (state[k].length) p.set(k, state[k].join(',')); });
  p.set('date', state.date);
  if (state.sort !== (options.sorts[0] && options.sorts[0].id)) p.set('sort', state.sort);
  if (state.page > 1) p.set('page', state.page);
  return `/sessions?${p.toString().replace(/%2C/g, ',')}`;
}
// აქტიური ფილტრების რაოდენობა (თარიღი არ ითვლება)
const activeCount = (s) => LIST_KEYS.reduce((n, k) => n + s[k].length, 0);

// სეანსების გვერდი: მარცხნივ ფილტრები, მარჯვნივ ფილმების მიხედვით დაჯგუფებული სეანსები.
// ფილტრის შეცვლა = navigate() ახალ URL-ზე; როუტერი იძახებს update()-ს, ის კი ხელახლა კითხულობს URL-ს და ტვირთავს მონაცემს.
export function mount(root, ctx) {
  let options = null;
  let state = null;
  // controller აუქმებს წინა მოთხოვნას (სწრაფი ფილტრების შეცვლისას ძველი პასუხი ახალს არ ჩაანაცვლებს)
  let controller = null;
  let lastData = null;

  const sidebar = h('aside', { class: 'filters', 'aria-label': 'Filters' });
  const results = h('section', { class: 'results', 'aria-live': 'polite' });
  root.append(h('div', { class: 'sessions-page' },
    h('header', { class: 'page-head' }, h('h1', null, 'Sessions'), h('p', { class: 'muted' }, 'Browse showtimes across all venues')),
    h('div', { class: 'sessions-layout' }, sidebar, results)));

  // ფილტრის ცვლილება -> ახალი URL (pushState, ამიტომ Back მუშაობს)
  const go = (patch, { keepPage = false } = {}) => {
    const next = { ...state, ...patch };
    if (!keepPage) next.page = 1; // ფილტრის ან სორტირების ნებისმიერი ცვლილება 1-ელ გვერდზე აბრუნებს
    navigate(toUrl(next, options), { scroll: false });
  };

  // ფორმატები, რომლებიც არჩეულ დარბაზებში არსებობს (დარბაზი არჩეული არ არის -> ყველა)
  function availableFormats(s) {
    if (!s.venue.length) return options.formats;
    const ids = new Set(options.venues.filter((v) => s.venue.includes(v.slug)).flatMap((v) => v.formats.map((f) => f.slug)));
    return options.formats.filter((f) => ids.has(f.slug));
  }

  // ჩექბოქსის გადართვა
  function toggle(key, slug) {
    const cur = state[key];
    const next = cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug];
    const patch = { [key]: next };
    if (key === 'venue') { // ფორმატებს ვავიწროებთ იმით, რასაც არჩეული დარბაზები რეალურად აჩვენებენ
      const avail = new Set(availableFormats({ ...state, venue: next }).map((f) => f.slug));
      patch.format = state.format.filter((f) => avail.has(f));
    }
    go(patch);
  }

  // ფილტრის ჯგუფი ჩექბოქსებით (ვიზუალურად მორგებული, მაგრამ ნამდვილი <input type=checkbox>)
  function checkGroup(title, key, items, labelOf, hintOf) {
    return h('fieldset', { class: 'fgroup' }, h('legend', null, title),
      items.map((it) => {
        const val = it.slug || it.id;
        return h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: state[key].includes(val) || null, onchange: () => toggle(key, val) }),
          h('span', { class: 'box' }, icon('check', 12)),
          h('span', { class: 'check-label' }, labelOf(it), hintOf && hintOf(it) && h('small', null, hintOf(it))));
      }));
  }

  // გვერდითი პანელი: Venue, Date (7 დღე), Format, Language, Time of day, Clear All Filters და აქტიური ფილტრების მთვლელი
  function renderSidebar() {
    const n = activeCount(state);
    const formats = availableFormats(state);
    const bandLabel = (b) => b.label.replace(/\s*\(.*\)/, '');
    const bandHint = (b) => (b.label.match(/\((.*)\)/) || [])[1];
    sidebar.replaceChildren(
      h('h2', null, 'Filters'),
      checkGroup('Venue', 'venue', options.venues, (v) => v.name, (v) => v.city),
      h('fieldset', { class: 'fgroup' }, h('legend', null, 'Date'),
        h('div', { class: 'date-row', role: 'group', 'aria-label': 'Date' },
          nextDays(7).map((d) => h('button', { type: 'button', class: `date-chip${d.ymd === state.date ? ' is-selected' : ''}`, 'aria-pressed': String(d.ymd === state.date), onclick: () => go({ date: d.ymd }) },
            h('span', null, d.dow), h('b', null, d.day))))),
      checkGroup('Format', 'format', formats, (f) => f.name),
      checkGroup('Language', 'language', options.languages, (l) => l.name),
      checkGroup('Time of day', 'time', options.timeBands, bandLabel, bandHint),
      h('div', { class: 'filters-foot' },
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-block', disabled: n === 0, onclick: clearAll }, 'Clear All Filters'),
        h('p', { class: 'muted', 'aria-live': 'polite' }, `${n} filter${n === 1 ? '' : 's'} active`)));
  }

  // ასუფთავებს ყველა ფილტრს გარდა თარიღისა
  const clearAll = () => go({ venue: [], format: [], language: [], time: [] });

  // ჩატვირთვის სკელეტონები სიისთვის (მთელ გვერდს არ ვფარავთ სპინერით)
  function skeleton() {
    results.replaceChildren(h('div', { class: 'results-head' }, h('div', { class: 'skeleton', style: { width: '150px', height: '16px' } })),
      ...[0, 1, 2].map(() => h('div', { class: 'group' },
        h('div', { class: 'group-head' }, h('div', { class: 'skeleton', style: { width: '48px', height: '68px' } }), h('div', { class: 'skeleton', style: { width: '220px', height: '22px' } })),
        h('div', { class: 'sc-row' }, ...[0, 1, 2, 3].map(() => h('div', { class: 'skeleton session-skel' }))))));
  }

  // პაგინაცია: ისრები, გვერდების ნომრები ბოლოებით და მიმდინარე გვერდის გარშემო (…-ით), "Page X of Y"
  function pagination(meta) {
    if (!meta || meta.lastPage <= 1) return null;
    const { currentPage: cur, lastPage: last } = meta;
    const nums = [...new Set([1, cur - 1, cur, cur + 1, last])].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
    const items = [];
    nums.forEach((n, i) => {
      if (i && n - nums[i - 1] > 1) items.push(h('span', { class: 'pg-gap' }, '…'));
      items.push(h('button', { type: 'button', class: `pg-num${n === cur ? ' is-current' : ''}`, 'aria-current': n === cur ? 'page' : null, 'aria-label': `Page ${n}`, onclick: () => go({ page: n }, { keepPage: true }) }, n));
    });
    return h('nav', { class: 'pagination', 'aria-label': 'Pagination' },
      h('button', { type: 'button', class: 'pg-arrow', 'aria-label': 'Previous page', disabled: cur <= 1, onclick: () => go({ page: cur - 1 }, { keepPage: true }) }, icon('left', 18)),
      ...items,
      h('button', { type: 'button', class: 'pg-arrow', 'aria-label': 'Next page', disabled: cur >= last, onclick: () => go({ page: cur + 1 }, { keepPage: true }) }, icon('right', 18)),
      h('p', { class: 'pg-text muted' }, `Page ${cur} of ${last}`));
  }

  // შედეგები: მთვლელი, სორტირება, ფილმების ჯგუფები სეანსებით, პაგინაცია; ცარიელი შედეგისას - განმარტება და გასუფთავების ღილაკი
  function renderResults(data) {
    lastData = data;
    const { meta } = data;
    const sortSel = h('select', { id: 'sort', 'aria-label': 'Sort sessions', onchange: (e) => go({ sort: e.target.value }) }, options.sorts.map((s) => h('option', { value: s.id }, s.label)));
    sortSel.value = state.sort;
    const head = h('div', { class: 'results-head' },
      h('p', { class: 'count' }, meta.totalSessions ? `Showing ${meta.totalSessions} session${meta.totalSessions === 1 ? '' : 's'}` : 'No sessions found'),
      h('label', { class: 'sort' }, h('span', { class: 'muted' }, 'Sort:'), h('span', { class: 'sort-wrap' }, sortSel, icon('down', 14))));
    if (!data.data.length) {
      const n = activeCount(state);
      results.replaceChildren(head, emptyState({ title: 'No sessions match your filters', message: n ? 'Try removing a filter or choosing another date.' : 'There are no showings on this date. Try another day.', actionLabel: n ? 'Clear All Filters' : null, onAction: clearAll, iconName: 'calendar' }));
      return;
    }
    const groups = data.data.map(({ movie, sessions }) => {
      const blocked = isAgeBlocked(movie);
      const row = h('div', { class: 'sc-row' }, sessions.map((s) => sessionCard(s, movie)));
      const sc = scroller(row);
      requestAnimationFrame(sc.refresh);
      return h('article', { class: 'group' },
        h('div', { class: 'group-head' },
          h('a', { class: 'group-poster', href: `/movies/${movie.slug}`, tabindex: '-1', 'aria-hidden': 'true' }, img(movie.posterUrl, '', '')),
          h('div', { class: 'group-title' },
            h('div', { class: 'gt-line' }, h('h2', null, h('a', { href: `/movies/${movie.slug}` }, movie.title)), ageBadge(movie)),
            h('p', { class: 'muted' }, `${movie.runtimeMinutes} min`),
            blocked && h('p', { class: 'age-note' }, ageBlockMessage(movie))),
          h('div', { class: 'arrows-wrap' }, sc.arrows)),
        sc.el);
    });
    results.replaceChildren(head, ...groups, pagination(meta));
  }

  // სეანსების ჩატვირთვა მიმდინარე ფილტრებით (შეცდომისას - retry)
  async function load() {
    if (controller) controller.abort();
    controller = new AbortController();
    const mine = controller;
    skeleton();
    try {
      const data = await api.sessions({ date: state.date, 'venues': state.venue, formats: state.format, languages: state.language, bands: state.time, sort: state.sort, page: state.page }, mine.signal);
      if (mine.signal.aborted) return;
      renderResults(data);
    } catch (e) {
      if (isAbort(e)) return;
      results.replaceChildren(errorState(e.message, load, "Couldn't load sessions"));
    }
  }

  // პირველად ჯერ ფილტრის პარამეტრებს ვტვირთავთ (დარბაზები, ფორმატები...), შემდეგ ვხატავთ პანელს და სიას
  async function init(c) {
    results.replaceChildren(h('div', { class: 'skeleton', style: { height: '300px' } }));
    sidebar.replaceChildren(h('div', { class: 'skeleton', style: { height: '600px' } }));
    try { options = await getOptions(); }
    catch (e) { results.replaceChildren(errorState(e.message, () => init(c), "Couldn't load filters")); sidebar.replaceChildren(); return; }
    apply(c);
  }
  function apply(c) { state = readState(c.query, options); renderSidebar(); load(); }

  init(ctx);
  // შესვლა/გასვლისას ბარათებს თავიდან ვხატავთ, რომ ასაკობრივი შეზღუდვები განახლდეს
  const unsub = subscribe(() => { if (lastData) renderResults(lastData); });
  return { update: (c) => { if (options) apply(c); }, destroy: () => { unsub(); if (controller) controller.abort(); } };
}

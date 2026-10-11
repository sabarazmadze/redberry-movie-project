// მინიმალური History API როუტერი. გვერდის მოდულები ექსპორტს უკეთებენ mount(root, ctx)-ს და შეუძლიათ დააბრუნონ { update(ctx), destroy() }.
// თუ იმავე მარშრუტზე მხოლოდ query იცვლება, გვერდი თავიდან არ იქმნება, არამედ იძახება update() (იყენებს სეანსების გვერდი).

// რეგისტრირებული მარშრუტები
const routes = [];
let active = null;     // აქტიური გვერდი: { name, instance }
// ნავიგაციის მთვლელი: ასინქრონული ჩატვირთვისას ვამოწმებთ, ჯერ კიდევ ბოლო ნავიგაცია ხომ არ არის
let navId = 0;
// ფუნქცია, რომელიც ყოველი რენდერის შემდეგ იძახება (navbar-ის აქტიური ბმულისთვის)
let afterRender = () => {};

// მარშრუტის აღწერა: pattern-ში `:slug` ტიპის პარამეტრებია, loader - გვერდის დინამიური import;
// hero: true ნიშნავს, რომ navbar გვერდის სურათზე გადადებულია (მთავარი და ფილმის გვერდი).
export function defineRoute(name, pattern, loader, { hero = false } = {}) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ name, regex, keys, loader, hero });
}

// ყოველი რენდერის შემდეგ გამოსაძახებელი ფუნქციის დაყენება
export function onRender(fn) { afterRender = fn; }

// pathname-ს ადარებს მარშრუტებს და აბრუნებს მარშრუტს + URL პარამეტრებს
function match(pathname) {
  for (const r of routes) {
    const m = r.regex.exec(pathname);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export const currentPath = () => location.pathname;
export const currentQuery = () => new URLSearchParams(location.search);

// გადასვლა ახალ URL-ზე (pushState); იგივე URL-ზე ან replace=true-ზე ისტორია არ იზრდება
export function navigate(url, { replace = false, scroll = true } = {}) {
  const target = new URL(url, location.origin);
  const same = target.pathname === location.pathname && target.search === location.search;
  if (replace || same) history.replaceState(null, '', target.pathname + target.search + target.hash);
  else history.pushState(null, '', target.pathname + target.search + target.hash);
  return render({ scroll });
}

// მიმდინარე URL-ის გამოსახვა: ჯერ ვცდილობთ update()-ს, სხვა შემთხვევაში ძველ გვერდს ვანადგურებთ და ახალს ვტვირთავთ
export async function render({ scroll = true } = {}) {
  const id = ++navId;
  const root = document.getElementById('app');
  const found = match(location.pathname);
  const ctx = { params: found ? found.params : {}, query: currentQuery(), path: location.pathname };

  // იგივე მარშრუტი და მხოლოდ query შეიცვალა: გვერდს თავად ვაახლებინებთ (ფილტრების შეცვლისას გადატვირთვა არ ხდება)
  if (found && active && active.name === found.route.name && active.instance && typeof active.instance.update === 'function') {
    active.instance.update(ctx);
    afterRender(found.route);
    return;
  }

  if (active && active.instance && typeof active.instance.destroy === 'function') active.instance.destroy();
  active = null;
  root.replaceChildren();
  document.body.classList.toggle('has-hero', !!(found && found.route.hero));
  afterRender(found ? found.route : null);
  if (scroll) window.scrollTo(0, 0);

  // გვერდის კოდი იტვირთება მხოლოდ საჭიროებისას; უცნობი მისამართისთვის - 404 გვერდი
  const loader = found ? found.route.loader : () => import('./pages/not-found.js');
  const mod = await loader();
  if (id !== navId) return; // ამასობაში ახალი ნავიგაცია დაიწყო, ძველს ვაუქმებთ
  const instance = mod.mount(root, ctx) || null;
  active = { name: found ? found.route.name : 'not-found', instance };
  root.focus({ preventScroll: true });
}

/** ვიჭერთ შიდა <a href="/..."> დაწკაპუნებებს, რომ გვერდი არ გადაიტვირთოს და აპი SPA-დ იმუშაოს. */
export function startRouter() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || href.startsWith('//')) return;
    e.preventDefault();
    navigate(href);
  });
  // ბრაუზერის უკან/წინ ღილაკები
  window.addEventListener('popstate', () => render({ scroll: false }));
  return render({ scroll: false });
}

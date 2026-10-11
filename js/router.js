// Minimal History-API router. Page modules export mount(root, ctx) and may return { update(ctx), destroy() }.
// When only the query string changes on the same route, update() is called instead of remounting (used by Sessions).

const routes = [];
let active = null;     // { name, instance }
let navId = 0;
let afterRender = () => {};

export function defineRoute(name, pattern, loader, { hero = false } = {}) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ name, regex, keys, loader, hero });
}

export function onRender(fn) { afterRender = fn; }

function match(pathname) {
  for (const r of routes) {
    const m = r.regex.exec(pathname);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export const currentPath = () => location.pathname;
export const currentQuery = () => new URLSearchParams(location.search);

export function navigate(url, { replace = false, scroll = true } = {}) {
  const target = new URL(url, location.origin);
  const same = target.pathname === location.pathname && target.search === location.search;
  if (replace || same) history.replaceState(null, '', target.pathname + target.search + target.hash);
  else history.pushState(null, '', target.pathname + target.search + target.hash);
  return render({ scroll });
}

export async function render({ scroll = true } = {}) {
  const id = ++navId;
  const root = document.getElementById('app');
  const found = match(location.pathname);
  const ctx = { params: found ? found.params : {}, query: currentQuery(), path: location.pathname };

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

  const loader = found ? found.route.loader : () => import('./pages/not-found.js');
  const mod = await loader();
  if (id !== navId) return; // a newer navigation superseded this one
  const instance = mod.mount(root, ctx) || null;
  active = { name: found ? found.route.name : 'not-found', instance };
  root.focus({ preventScroll: true });
}

/** Intercept same-origin <a href="/..."> clicks so the app behaves as an SPA. */
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
  window.addEventListener('popstate', () => render({ scroll: false }));
  return render({ scroll: false });
}

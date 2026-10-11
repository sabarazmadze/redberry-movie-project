// პატარა DOM დამხმარე ფუნქციები. ყველა დინამიური ტექსტი createTextNode-ით ჩაჯდება,
// ამიტომ API-დან მოსული მონაცემი არასდროს ინტერპრეტირდება HTML-ად (XSS-ისგან დაცვა).

// ელემენტის შექმნა: h('div', {class: 'x', onclick: fn}, ...შვილები).
// 'on...' ატრიბუტები ხდება event listener-ად, false/null ატრიბუტები გამოტოვებულია.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') el.value = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

// ამატებს შვილებს (ტექსტს, ელემენტებს ან ჩაშენებულ მასივებს); null/false გამოტოვებულია
export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

// შლის ელემენტის ყველა შვილს
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
// ელემენტის შიგთავსს ცვლის ახალი შვილებით
export function render(el, ...children) { clear(el); return append(el, children); }

// ფუნქციას აყოვნებს: გამოიძახება მხოლოდ მაშინ, როცა ბოლო გამოძახებიდან ms მილიწამი გავიდა (ძიებისთვის)
export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

// ---- ხატულები (სტატიკური, სანდო SVG კოდი) ---------------------------------
const ICONS = {
  ticket: '<path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5V7a1.5 1.5 0 0 0 0 3v1.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5V10a1.5 1.5 0 0 0 0-3V5.5Z" fill="currentColor"/>',
  bell: '<path d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v2.2L3.3 10.4a.6.6 0 0 0 .5.9h8.4a.6.6 0 0 0 .5-.9L11.5 8.2V6A3.5 3.5 0 0 0 8 2.5ZM6.6 12.3a1.4 1.4 0 0 0 2.8 0" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  timer: '<circle cx="7" cy="8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M7 5.6V8l1.6 1M5.5 1.8h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  search: '<circle cx="6.3" cy="6.3" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m9.5 9.5 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  left: '<path d="M14 5 8 11l6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2 1)"/>',
  right: '<path d="m10 5 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2 1)"/>',
  down: '<path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  check: '<path d="m3.5 8.4 3 3 6-6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  user: '<circle cx="8" cy="5.5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.8 13.2c.6-2.4 2.6-3.6 5.2-3.6s4.6 1.2 5.2 3.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  logout: '<path d="M6.5 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.5M10 5.2 12.8 8 10 10.8M12.6 8H6.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  calendar: '<rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  film: '<rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 2.5v11M10 2.5v11M2.5 6h3.5M10 6h3.5M2.5 10h3.5M10 10h3.5" stroke="currentColor" stroke-width="1"/>',
  upload: '<path d="M8 10.5V3.5M5.2 6.2 8 3.4l2.8 2.8M3 11.5v1h10v-1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  alert: '<path d="M8 2.2 14 12.8H2L8 2.2ZM8 6.5v3M8 11.2v.1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
};

// აბრუნებს ხატულას <span>-ს სასურველი ზომით; viewBox ხატულის ტიპის მიხედვით განისაზღვრება
export function icon(name, size = 16, cls = '') {
  const span = document.createElement('span');
  span.className = `icon ${cls}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.style.width = span.style.height = `${size}px`;
  const viewBox = name === 'left' || name === 'right' ? '0 0 24 24' : name === 'timer' ? '0 0 14 14' : '0 0 16 16';
  span.innerHTML = `<svg viewBox="${viewBox}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${ICONS[name] || ''}</svg>`;
  return span;
}

/** პოსტერის/ფონის <img>. თუ მისამართი ცარიელია ან სურათი ვერ ჩაიტვირთა, ჩანს მუქი ჩანაცვლება. */
export function img(src, alt, cls) {
  const el = h('img', { class: cls || '', alt: alt || '', loading: 'lazy', decoding: 'async' });
  const fail = () => { el.removeAttribute('src'); el.classList.add('img-fallback'); };
  if (!src) fail();
  else { el.addEventListener('error', fail, { once: true }); el.src = src; }
  return el;
}

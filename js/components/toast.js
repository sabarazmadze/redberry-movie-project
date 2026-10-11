import { h } from '../dom.js';

export function toast(message, { type = 'info', duration = 4500 } = {}) {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  root.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const remove = () => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 200); };
  setTimeout(remove, duration);
  el.addEventListener('click', remove);
  return el;
}

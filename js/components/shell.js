import { h, icon, img } from '../dom.js';
import { createSearch } from './search.js';
import { openAuthModal } from '../modals/auth.js';
import { getUser, subscribe, logout } from '../auth.js';
import { navigate, currentPath } from '../router.js';
import { initials } from '../format.js';
import { toast } from './toast.js';

let navLinkSessions;
let rightSlot;
let closeMenu = () => {};

export function mountShell() {
  const header = document.getElementById('app-header');
  const search = createSearch();
  navLinkSessions = h('a', { class: 'nav-link', href: '/sessions' }, 'Sessions');
  rightSlot = h('div', { class: 'nav-actions' });

  header.replaceChildren(h('nav', { class: 'navbar', 'aria-label': 'Main' },
    h('div', { class: 'nav-left' }, h('a', { class: 'logo', href: '/', 'aria-label': 'Kino XII home' }, h('span', null, 'KINO'), h('span', null, 'XII')), navLinkSessions),
    h('div', { class: 'nav-right' }, search.el, rightSlot)));

  document.getElementById('app-footer').replaceChildren(h('footer', { class: 'footer' },
    h('div', { class: 'footer-inner' }, h('a', { class: 'logo', href: '/' }, h('span', null, 'KINO'), h('span', null, 'XII')), h('small', null, '© 2026 Kino XII. All rights reserved.'))));

  renderAccount(getUser());
  subscribe(renderAccount);
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.user')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

export function updateActiveLink() {
  if (navLinkSessions) navLinkSessions.classList.toggle('is-active', currentPath().startsWith('/sessions'));
}

function renderAccount(user) {
  if (!rightSlot) return;
  closeMenu = () => {};
  if (!user) {
    rightSlot.replaceChildren(
      h('button', { type: 'button', class: 'btn btn-red', onclick: () => openAuthModal({ mode: 'register' }) }, 'Sign up'),
      h('button', { type: 'button', class: 'btn btn-white', onclick: () => openAuthModal({ mode: 'login' }) }, 'Log in'));
    return;
  }
  const first = (user.fullName || user.username || '').split(' ')[0];
  const avatar = (size) => h('span', { class: 'avatar', style: size ? { width: `${size}px`, height: `${size}px` } : null },
    user.avatar ? img(user.avatar, '', '') : initials(user.fullName || user.username),
    h('span', { class: `dot${user.profileComplete ? ' ok' : ''}`, title: user.profileComplete ? 'Profile complete' : 'Profile incomplete' }));

  const menu = h('div', { class: 'user-menu', role: 'menu', hidden: true });
  const btn = h('button', { type: 'button', class: 'user-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    avatar(), h('span', { class: 'user-name' }, first), icon('down', 16));
  const go = (url) => () => { closeMenu(); navigate(url); };

  menu.append(
    h('div', { class: 'who' }, avatar(40), h('span', null, h('b', null, user.fullName || user.username), h('small', null, user.email))),
    user.profileComplete
      ? h('div', { class: 'menu-status ok' }, 'Profile Complete ✓')
      : h('button', { type: 'button', class: 'menu-status warn', onclick: go('/profile') }, h('b', null, 'Profile incomplete'), 'Please complete your profile to enable booking.'),
    h('button', { type: 'button', class: 'menu-item', role: 'menuitem', onclick: go('/profile') }, icon('user', 16), 'My Profile'),
    h('button', { type: 'button', class: 'menu-item', role: 'menuitem', onclick: go('/profile?tab=tickets') }, icon('ticket', 16), 'My Tickets'),
    h('button', { type: 'button', class: 'menu-item danger', role: 'menuitem', onclick: async () => {
      closeMenu();
      await logout();
      toast('You have been logged out.');
      if (currentPath().startsWith('/profile')) navigate('/');
    } }, icon('logout', 16), 'Log out'));

  closeMenu = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => { menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
  rightSlot.replaceChildren(h('div', { class: 'user' }, btn, menu));
}

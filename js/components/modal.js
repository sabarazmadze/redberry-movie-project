import { h, icon, append } from '../dom.js';

// Modal manager. Every modal in the app goes through here so the behaviour is identical:
// dimmed + blurred backdrop, X / Close button, Escape key and overlay click all close it.

const stack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function syncBody() { document.body.classList.toggle('no-scroll', stack.length > 0); }

export function openModal({ content, className = '', label = 'Dialog', dismissible = true, onClose } = {}) {
  const previouslyFocused = document.activeElement;
  const dialog = h('div', { class: `modal ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' });
  const overlay = h('div', { class: 'modal-overlay' }, dialog);
  let closed = false;

  const api = {
    el: dialog,
    setContent(...nodes) { dialog.replaceChildren(); append(dialog, nodes); },
    setDismissible(v) { api.dismissible = v; },
    dismissible,
    close(reason) {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      overlay.classList.add('is-leaving');
      setTimeout(() => overlay.remove(), 120);
      syncBody();
      if (previouslyFocused && previouslyFocused.focus && document.contains(previouslyFocused)) previouslyFocused.focus();
      if (onClose) onClose(reason);
    },
  };

  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay && api.dismissible) api.close('overlay'); });
  if (content) api.setContent(content);
  document.getElementById('modal-root').append(overlay);
  stack.push(api);
  syncBody();
  requestAnimationFrame(() => {
    const first = dialog.querySelector('input:not([type=hidden]), select, textarea') || dialog.querySelector(FOCUSABLE);
    (first || dialog).focus({ preventScroll: true });
  });
  return api;
}

document.addEventListener('keydown', (e) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape' && top.dismissible) { e.preventDefault(); top.close('escape'); }
  if (e.key === 'Tab') { // keep focus inside the dialog
    const items = [...top.el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

export function closeButton(onClick, label = 'Close') {
  return h('button', { type: 'button', class: 'modal-x', 'aria-label': label, onclick: onClick }, icon('close', 16));
}

/** Promise<boolean> confirmation dialog. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const modal = openModal({ label: title, className: 'modal-sm', onClose: () => resolve(answer) });
    const yes = h('button', { type: 'button', class: `btn ${danger ? 'btn-red' : 'btn-red'}`, onclick: () => { answer = true; modal.close('confirm'); } }, confirmLabel);
    modal.setContent(
      h('div', { class: 'modal-head' }, h('h2', { class: 'modal-title' }, title), closeButton(() => modal.close('x'))),
      h('p', { class: 'modal-sub confirm-msg' }, message),
      h('div', { class: 'modal-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close('cancel') }, cancelLabel), yes),
    );
  });
}

/** Simple informational dialog with a single Close button. */
export function infoDialog({ title, message, actionLabel, onAction }) {
  const modal = openModal({ label: title, className: 'modal-sm' });
  modal.setContent(
    h('div', { class: 'modal-head' }, h('h2', { class: 'modal-title' }, title), closeButton(() => modal.close('x'))),
    h('p', { class: 'modal-sub confirm-msg' }, message),
    h('div', { class: 'modal-actions' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => modal.close('close') }, 'Close'),
      actionLabel && h('button', { type: 'button', class: 'btn btn-red', onclick: () => { modal.close('action'); onAction && onAction(); } }, actionLabel)),
  );
  return modal;
}

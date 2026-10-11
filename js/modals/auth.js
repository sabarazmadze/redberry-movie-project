import { h, icon } from '../dom.js';
import { openModal, closeButton } from '../components/modal.js';
import { createField, validators, applyServerErrors } from '../components/field.js';
import { toast } from '../components/toast.js';
import { login, register, isAuthed } from '../auth.js';

// ავატარის დასაშვები ფორმატები და მაქსიმალური ზომა
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX = 2 * 1024 * 1024;

/**
 * ხსნის შესვლის / რეგისტრაციის მოდალს. ორ ხედს შორის გადართვისას ერთი და იგივე მოდალი გამოიყენება.
 * onSuccess სრულდება წარმატებული შესვლის ან რეგისტრაციის შემდეგ (გამოიყენება შეწყვეტილი მოქმედების გასაგრძელებლად);
 * onCancel სრულდება, თუ მოდალი დაიხურა შესვლის გარეშე.
 */
export function openAuthModal({ mode = 'login', notice = '', onSuccess, onCancel } = {}) {
  let succeeded = false;
  const modal = openModal({
    className: 'modal-auth',
    label: mode === 'login' ? 'Log in' : 'Sign up',
    onClose: () => { if (!succeeded && onCancel) onCancel(); },
  });

  // წარმატების შემდეგ: მოდალი იხურება, მხოლოდ ახალი ანგარიშისას ვაჩვენებთ შეტყობინებას პროფილის შევსების შესახებ და ვაგრძელებთ შეწყვეტილ მოქმედებას
  const done = (user, fresh) => {
    succeeded = true;
    modal.close('success');
    if (fresh) toast('Welcome to Kino XII! Complete your profile to start booking.', { type: 'success' });
    if (onSuccess) onSuccess(user);
  };

  const close = () => modal.close('x');
  // ორ ხედს შორის გადართვა (login <-> register)
  const show = (view) => modal.setContent(view === 'login' ? loginView(show, done, notice, close) : registerView(show, done, close));
  show(mode);
  return modal;
}

// ფორმის ზოგადი შეცდომის ბლოკი (API-ს შეტყობინებისთვის)
function formError() { return h('div', { class: 'form-error', role: 'alert', hidden: true }); }
function setFormError(el, message) { el.textContent = message || ''; el.hidden = !message; }

// გაგზავნის ღილაკი loading მდგომარეობით (გათიშულია მოთხოვნის დროს)
function submitButton(label) {
  const btn = h('button', { type: 'submit', class: 'btn btn-red btn-block btn-lg' }, h('span', { class: 'btn-label' }, label));
  btn.setLoading = (on) => { btn.disabled = on; btn.classList.toggle('is-loading', on); btn.setAttribute('aria-busy', on ? 'true' : 'false'); };
  return btn;
}

// შესვლის ხედი: Email + Password. შეცდომისას მოდალი რჩება ღია, ელფოსტა ინახება
function loginView(show, done, notice, close) {
  const email = createField({ label: 'Email', name: 'email', type: 'email', placeholder: 'example@gmail.com', autocomplete: 'email', validate: validators.email });
  const password = createField({ label: 'Password', name: 'password', type: 'password', placeholder: '••••••••', autocomplete: 'current-password', validate: validators.password });
  const error = formError();
  const submit = submitButton('Log In');
  let busy = false;

  const form = h('form', { class: 'modal-form', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (busy) return;
      setFormError(error, '');
      const ok = [email.touch(), password.touch()].every(Boolean);
      if (!ok) return;
      busy = true; submit.setLoading(true);
      try {
        const user = await login(email.value.trim(), password.value);
        done(user, false);
      } catch (err) {
        busy = false; submit.setLoading(false);
        if (err.status === 422 && err.errors) { const rest = applyServerErrors(err.errors, { email, password }); if (rest.length) setFormError(error, rest[0]); }
        else setFormError(error, err.message); // 401 = არასწორი მონაცემები, ან ქსელის / 500 შეცდომა
        password.input.value = '';              // ელფოსტა რჩება, პაროლი იშლება
      }
    } },
    notice && h('div', { class: 'form-notice' }, icon('alert', 16), h('span', null, notice)),
    error, email.el, password.el, submit);

  return [
    h('div', { class: 'modal-head' }, h('div', null, h('h2', { class: 'modal-title' }, 'Log in'), h('p', { class: 'modal-sub' }, 'Welcome back to Kino XII')), closeButton(close)),
    form,
    h('p', { class: 'modal-foot' }, "Don't have an account? ", h('button', { type: 'button', class: 'link-red', onclick: () => show('register') }, 'Sign up')),
  ];
}

// რეგისტრაციის ხედი: ავატარი (არასავალდებულო, წინასწარი გადახედვით), Username, Email, Password, Confirm Password
function registerView(show, done, close) {
  let avatarFile = null;
  const preview = h('span', { class: 'avatar-preview' }, icon('upload', 18));
  const avatarMsg = h('p', { class: 'field-msg', role: 'alert' });
  const fileInput = h('input', { type: 'file', accept: AVATAR_TYPES.join(','), class: 'sr-only', id: 'avatar-input', tabindex: '-1' });
  const avatarRow = h('label', { class: 'avatar-row', for: 'avatar-input' }, preview,
    h('span', { class: 'avatar-copy' }, h('strong', null, 'Upload avatar ', h('span', { class: 'field-opt' }, '(optional)')), h('small', null, 'JPG, PNG or WebP · max 2 MB')));
  // ავატარის არჩევა: ვამოწმებთ ფორმატს (jpg/png/webp) და ზომას; წარმატების შემთხვევაში ვაჩვენებთ preview-ს
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    avatarMsg.textContent = '';
    avatarFile = null;
    preview.replaceChildren(icon('upload', 18));
    preview.classList.remove('has-img');
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) { avatarMsg.textContent = 'Avatar must be a JPG, PNG or WebP image'; fileInput.value = ''; return; }
    if (file.size > AVATAR_MAX) { avatarMsg.textContent = 'Avatar must be 2 MB or smaller'; fileInput.value = ''; return; }
    avatarFile = file;
    const url = URL.createObjectURL(file);
    const im = h('img', { src: url, alt: 'Avatar preview' });
    im.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
    preview.replaceChildren(im);
    preview.classList.add('has-img');
  });

  const username = createField({ label: 'Username', name: 'username', placeholder: 'User', autocomplete: 'username', validate: validators.username });
  const email = createField({ label: 'Email', name: 'email', type: 'email', placeholder: 'example@gmail.com', autocomplete: 'email', validate: validators.email });
  // Confirm Password უნდა ემთხვეოდეს Password-ს (password ველი ქვემოთაა გამოცხადებული - გამოიყენება მხოლოდ ვალიდაციისას)
  const confirm = createField({ label: 'Confirm password', name: 'password_confirmation', type: 'password', placeholder: '••••••••', autocomplete: 'new-password',
    validate: (v) => (!v ? 'Please confirm your password' : v !== password.value ? 'Passwords do not match' : '') });
  const password = createField({ label: 'Password', name: 'password', type: 'password', placeholder: '••••••••', autocomplete: 'new-password', validate: validators.password,
    onChange: () => { if (confirm.value) confirm.validate(); } });
  const error = formError();
  const submit = submitButton('Sign up');
  let busy = false;

  const form = h('form', { class: 'modal-form', novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (busy) return;
      setFormError(error, '');
      const ok = [username.touch(), email.touch(), password.touch(), confirm.touch()].every(Boolean);
      if (!ok || avatarMsg.textContent) return;
      busy = true; submit.setLoading(true);
      const body = new FormData();
      body.append('username', username.value.trim());
      body.append('email', email.value.trim());
      body.append('password', password.value);
      body.append('password_confirmation', confirm.value);
      if (avatarFile) body.append('avatar', avatarFile);
      try {
        const user = await register(body);
        done(user, true);
      } catch (err) {
        busy = false; submit.setLoading(false);
        if (err.status === 422 && err.errors) {
          if (err.errors.avatar) avatarMsg.textContent = err.errors.avatar[0];
          const rest = applyServerErrors(err.errors, { username, email, password, password_confirmation: confirm });
          if (rest.length) setFormError(error, rest[0]);
        } else setFormError(error, err.message);
      }
    } },
    error, avatarRow, fileInput, avatarMsg, username.el, email.el,
    h('div', { class: 'field-row' }, password.el, confirm.el), submit);

  return [
    h('div', { class: 'modal-head' }, h('div', null, h('h2', { class: 'modal-title' }, 'Sign up'), h('p', { class: 'modal-sub' }, 'Welcome to Kino XII')), closeButton(close)),
    form,
    h('p', { class: 'modal-foot' }, 'Already have an account? ', h('button', { type: 'button', class: 'link-red', onclick: () => show('login') }, 'Log in')),
  ];
}

/** თუ მომხმარებელი ავტორიზებულია, action მაშინვე სრულდება; სხვა შემთხვევაში იხსნება შესვლის მოდალი და action სრულდება შესვლისთანავე. */
export function requireAuth(action, { notice } = {}) {
  if (isAuthed()) return action();
  return new Promise((resolve) => {
    openAuthModal({ mode: 'login', notice, onSuccess: () => resolve(action()), onCancel: () => resolve(undefined) });
  });
}

import { h, icon } from '../dom.js';

let uid = 0;

/**
 * Labelled input with validation that runs on blur (and live once the field has been touched).
 * validate(value) returns an error string, or '' when fine.
 * Valid + non-empty -> green border and check mark; invalid -> red border and message.
 */
export function createField({
  label, name, type = 'text', placeholder = '', validate = () => '', value = '', autocomplete,
  inputmode, maxlength, readOnly = false, hint, optional = false, format, onChange, trailing,
}) {
  const id = `f-${name}-${++uid}`;
  const input = h('input', {
    id, name, type, placeholder, autocomplete, inputmode, maxlength, 'aria-describedby': `${id}-msg`,
    readonly: readOnly, 'aria-readonly': readOnly ? 'true' : null,
  });
  input.value = value;
  const check = h('span', { class: 'field-check' }, icon('check', 16));
  const msg = h('p', { class: 'field-msg', id: `${id}-msg`, role: 'alert' });
  const wrap = h('div', { class: 'field-control' }, input, trailing, check);
  const el = h('div', { class: `field${readOnly ? ' is-readonly' : ''}` },
    h('label', { class: 'field-label', for: id }, label, optional && h('span', { class: 'field-opt' }, ' (Optional)')),
    wrap, hint && h('p', { class: 'field-hint' }, hint), msg);

  let touched = false;
  let serverError = '';

  const api = {
    el, input,
    get value() { return input.value; },
    setValue(v) { input.value = v; if (touched) api.validate(); },
    /** Run validation and paint the result. Returns true when valid. */
    validate() {
      const err = serverError || validate(input.value);
      paint(err);
      return !err;
    },
    isValid() { return !validate(input.value); },
    setError(message) { serverError = message || ''; touched = true; paint(serverError); },
    touch() { touched = true; return api.validate(); },
    reset(v = '') { input.value = v; touched = false; serverError = ''; paint('', true); },
    focus() { input.focus(); },
  };

  function paint(err, silent) {
    const hasValue = input.value.trim() !== '';
    el.classList.toggle('is-invalid', !!err);
    el.classList.toggle('is-valid', !err && hasValue && !silent && !readOnly);
    input.setAttribute('aria-invalid', err ? 'true' : 'false');
    msg.textContent = err || '';
  }

  input.addEventListener('blur', () => { if (readOnly) return; touched = true; serverError = ''; api.validate(); });
  input.addEventListener('input', () => {
    if (format) { const f = format(input.value); if (f !== input.value) input.value = f; }
    if (serverError) serverError = '';
    if (touched) api.validate();
    if (onChange) onChange(input.value);
  });
  return api;
}

/** Select with the same chrome as a field. options: [{value,label}] */
export function createSelect({ label, name, options, value = '', placeholder = 'Select…', optional = false, onChange }) {
  const id = `f-${name}-${++uid}`;
  const select = h('select', { id, name }, h('option', { value: '' }, placeholder),
    options.map((o) => h('option', { value: String(o.value) }, o.label)));
  select.value = String(value ?? '');
  const el = h('div', { class: 'field' },
    h('label', { class: 'field-label', for: id }, label, optional && h('span', { class: 'field-opt' }, ' (Optional)')),
    h('div', { class: 'field-control field-select' }, select, h('span', { class: 'field-chev' }, icon('down', 16))));
  select.addEventListener('change', () => onChange && onChange(select.value));
  return { el, select, get value() { return select.value; }, setValue(v) { select.value = String(v ?? ''); } };
}

// ---- shared validators -------------------------------------------------------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validators = {
  email: (v) => (!v.trim() ? 'Email is required' : !EMAIL_RE.test(v.trim()) ? 'Please enter a valid email address' : ''),
  password: (v) => (!v ? 'Password is required' : v.length < 3 ? 'Password must be at least 3 characters' : ''),
  username: (v) => (!v.trim() ? 'Username is required' : v.trim().length < 3 ? 'Username must be at least 3 characters' : ''),
};

/** Map a 422 `errors` object ({field: [msg]}) onto fields keyed by the same names. Returns unmapped messages. */
export function applyServerErrors(errors, fields) {
  const leftovers = [];
  for (const [key, msgs] of Object.entries(errors || {})) {
    const f = fields[key];
    const text = Array.isArray(msgs) ? msgs[0] : String(msgs);
    if (f) f.setError(text); else leftovers.push(text);
  }
  return leftovers;
}

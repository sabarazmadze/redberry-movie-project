import { h, icon } from '../dom.js';

// უნიკალური id-ების მთვლელი (label-ისა და input-ის დასაკავშირებლად)
let uid = 0;

/**
 * ველი ლეიბლით, რომლის ვალიდაციაც ხდება ფოკუსის დაკარგვისას (blur), შემდეგ კი - ყოველი შეყვანისას.
 * validate(value) აბრუნებს შეცდომის ტექსტს ან '' თუ ყველაფერი წესრიგშია.
 * ვალიდური და არაცარიელი -> მწვანე ჩარჩო და ✓; არავალიდური -> წითელი ჩარჩო და შეტყობინება.
 */
export function createField({
  label, name, type = 'text', placeholder = '', validate = () => '', value = '', autocomplete,
  inputmode, maxlength, readOnly = false, hint, optional = false, format, onChange, trailing,
}) {
  // ყოველ ველს უნიკალური id აქვს, რომ label სწორ input-ს მიება და aria-describedby მუშაობდეს
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

  // touched: მომხმარებელი უკვე შეხებია ველს (მანამდე შეცდომას არ ვაჩვენებთ); serverError: API-ს მიერ დაბრუნებული შეცდომა კონკრეტულ ველზე
  let touched = false;
  let serverError = '';

  // ველის გარე ინტერფეისი: value, validate(), setError() (სერვერის შეცდომისთვის), touch(), reset()
  const api = {
    el, input,
    get value() { return input.value; },
    setValue(v) { input.value = v; if (touched) api.validate(); },
    /** ასრულებს ვალიდაციას და აჩვენებს შედეგს. აბრუნებს true-ს, თუ ველი ვალიდურია. */
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

  // აფერადებს ველს: შეცდომა -> წითელი, ვალიდური და არაცარიელი -> მწვანე; განახლებს aria-invalid-ს
  function paint(err, silent) {
    const hasValue = input.value.trim() !== '';
    el.classList.toggle('is-invalid', !!err);
    el.classList.toggle('is-valid', !err && hasValue && !silent && !readOnly);
    input.setAttribute('aria-invalid', err ? 'true' : 'false');
    msg.textContent = err || '';
  }

  // ფოკუსის დაკარგვისას ვამოწმებთ (დავალების მოთხოვნა: შეცდომა ჩანს on blur)
  input.addEventListener('blur', () => { if (readOnly) return; touched = true; serverError = ''; api.validate(); });
  // შეყვანისას: ვაფორმატებთ (მაგ. ბარათის ნომერი), სერვერის ძველ შეცდომას ვშლით და თუ ველს უკვე შევეხეთ, ვალიდაციას ცოცხლად ვაახლებთ
  input.addEventListener('input', () => {
    if (format) { const f = format(input.value); if (f !== input.value) input.value = f; }
    if (serverError) serverError = '';
    if (touched) api.validate();
    if (onChange) onChange(input.value);
  });
  return api;
}

/** ჩამოსაშლელი სია ველის იგივე სტილით. options: [{value, label}] */
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

// ---- საერთო ვალიდატორები ------------------------------------------------------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// ხშირად გამოყენებული ვალიდატორები (login/register მოდალებში)
export const validators = {
  email: (v) => (!v.trim() ? 'Email is required' : !EMAIL_RE.test(v.trim()) ? 'Please enter a valid email address' : ''),
  password: (v) => (!v ? 'Password is required' : v.length < 3 ? 'Password must be at least 3 characters' : ''),
  username: (v) => (!v.trim() ? 'Username is required' : v.trim().length < 3 ? 'Username must be at least 3 characters' : ''),
};

/** 422-ის `errors` ობიექტს ({ველი: [შეტყობინება]}) ანაწილებს შესაბამის ველებზე. აბრუნებს იმ შეტყობინებებს, რომლებსაც ველი არ მოუძებნა. */
export function applyServerErrors(errors, fields) {
  const leftovers = [];
  for (const [key, msgs] of Object.entries(errors || {})) {
    const f = fields[key];
    const text = Array.isArray(msgs) ? msgs[0] : String(msgs);
    if (f) f.setError(text); else leftovers.push(text);
  }
  return leftovers;
}

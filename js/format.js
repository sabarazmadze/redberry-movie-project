// Date / money helpers. Dates from the API are plain "YYYY-MM-DD" strings; parse them as LOCAL dates
// (new Date('2026-10-14') would be UTC and can shift the day).

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n) => String(n).padStart(2, '0');

export function parseDate(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function toYmd(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
export const todayYmd = () => toYmd(new Date());

/** The next `count` calendar days starting today. */
export function nextDays(count = 7) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    out.push({ ymd: toYmd(d), dow: DAYS[d.getDay()], day: d.getDate() });
  }
  return out;
}

export const shortDate = (ymd) => { const d = parseDate(ymd); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const longDate = (ymd) => { const d = parseDate(ymd); return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`; };
export const fullDate = (ymd) => { const d = parseDate(ymd); return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; };
export const dayMonth = (ymd) => { const d = parseDate(ymd); return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`.toUpperCase(); };

/** "14:30, Tue 15 Sep" for (session.date, session.time) minus `hours`. */
export function minusHours(ymd, time, hours) {
  const [hh, mm] = time.split(':').map(Number);
  const d = parseDate(ymd);
  d.setHours(hh, mm, 0, 0);
  d.setTime(d.getTime() - hours * 3600 * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}, ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function price(n) {
  const v = Number(n) || 0;
  return `₾${Number.isInteger(v) ? v : v.toFixed(2)}`;
}
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function mmss(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

/** Whole years between a YYYY-MM-DD birth date and today. */
export function ageFrom(ymd) {
  const b = parseDate(ymd);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

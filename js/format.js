// თარიღისა და თანხის დამხმარე ფუნქციები. API-დან თარიღი მოდის როგორც "YYYY-MM-DD" სტრიქონი;
// მას ვკითხულობთ ლოკალურ თარიღად (new Date('2026-10-14') UTC-ა და დღე შეიძლება შეეცვალოს).

// დღეებისა და თვეების სახელები ხელით გვაქვს, რომ ბრაუზერის locale-ზე არ ვიყოთ დამოკიდებული
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// რიცხვს ორნიშნა სტრიქონად აქცევს: 5 -> "05"
const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DD" -> ლოკალური Date ობიექტი
export function parseDate(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
// Date -> "YYYY-MM-DD" (ლოკალური თარიღით, toISOString-ის გარეშე, რომ დღე არ აირიოს)
export function toYmd(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
// დღევანდელი თარიღი "YYYY-MM-DD" ფორმატით
export const todayYmd = () => toYmd(new Date());

/** მომდევნო `count` დღე, დღევანდელით დაწყებული (თარიღის არჩევანისთვის). */
export function nextDays(count = 7) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    out.push({ ymd: toYmd(d), dow: DAYS[d.getDay()], day: d.getDate() });
  }
  return out;
}

// მოკლე თარიღი: "Tue 15 Sep"
export const shortDate = (ymd) => { const d = parseDate(ymd); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
// გრძელი თარიღი: "Tuesday 15 September"
export const longDate = (ymd) => { const d = parseDate(ymd); return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`; };
// სრული თარიღი წლით: "15 September 2026"
export const fullDate = (ymd) => { const d = parseDate(ymd); return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; };
// დიდი ასოებით: "15 SEPTEMBER" (მალე კინოში ბარათებისთვის)
export const dayMonth = (ymd) => { const d = parseDate(ymd); return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`.toUpperCase(); };

/** აბრუნებს "14:30, Tue 15 Sep" ფორმატს: სეანსის დრო მინუს `hours` საათი (თანხის დაბრუნების ბოლო ვადა). */
export function minusHours(ymd, time, hours) {
  const [hh, mm] = time.split(':').map(Number);
  const d = parseDate(ymd);
  d.setHours(hh, mm, 0, 0);
  d.setTime(d.getTime() - hours * 3600 * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}, ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// თანხა ლარის ნიშნით: მთელი რიცხვი უცვლელად, წილადი ორი ათწილადით (₾38.50)
export function price(n) {
  const v = Number(n) || 0;
  return `₾${Number.isInteger(v) ? v : v.toFixed(2)}`;
}
// თანხის დამრგვალება 2 ათწილადამდე (წილადური ცდომილების თავიდან ასაცილებლად)
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// წამები -> "წთ:წმ" (ტაიმერისთვის)
export function mmss(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

// სახელის ინიციალები ავატარისთვის (მაქს. 2 ასო)
export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

/** სრული წლები დაბადების თარიღსა (YYYY-MM-DD) და დღევანდელ დღეს შორის. */
export function ageFrom(ymd) {
  const b = parseDate(ymd);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

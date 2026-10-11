// სესიის მდგომარეობა: ავტორიზებული მომხმარებელი ინახება აქ, დანარჩენი ნაწილები მასზე გამოიწერებიან (subscribe).
import { api, setToken, getToken } from './api.js';

// მიმდინარე მომხმარებელი (null = სტუმარი)
let user = null;
// ცვლილებებზე გამოწერილი ფუნქციები (navbar, გვერდები)
const subscribers = new Set();

// მარტივი getter-ები
export const getUser = () => user;
export const isAuthed = () => !!user;
// ამატებს მსმენელს; აბრუნებს გამოწერის გაუქმების ფუნქციას
export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
// ცვლის მომხმარებელს და ატყობინებს ყველა გამომწერს
export function setUser(next) { user = next; subscribers.forEach((fn) => fn(user)); }

/** სესიის აღდგენა გვერდის ჩატვირთვისას. 401 ნიშნავს, რომ შენახული ტოკენი ვადაგასულია: ვშლით და სტუმრად ვაგრძელებთ. */
export async function initAuth() {
  if (!getToken()) return;
  try { setUser(await api.me()); }
  catch (e) { if (e.status === 401) setToken(null); }
}

// login/register-ის წარმატების შემდეგ: ვინახავთ ტოკენს და მომხმარებელს
async function finish(result) { setToken(result.token); setUser(result.user); return result.user; }
export const login = async (email, password) => finish(await api.login(email, password));
export const register = async (form) => finish(await api.register(form));

// გასვლა: სერვერს ვატყობინებთ და ლოკალურ სესიას ვასუფთავებთ
export async function logout() {
  try { await api.logout(); } catch { /* სერვერის პასუხის მიუხედავად ლოკალურად მაინც ვასუფთავებთ */ }
  setToken(null);
  setUser(null);
}

/** იძახება, როცა დაცულმა მოთხოვნამ 401 დააბრუნა: მკვდარ ტოკენს ვშლით და ინტერფეისი სტუმრის რეჟიმზე გადადის. */
export function expireSession() { setToken(null); setUser(null); }

/** true, თუ ავტორიზებული მომხმარებელი ფილმის ასაკობრივ შეზღუდვას ვერ აკმაყოფილებს (ასაკი პროფილის დაბადების თარიღიდან). */
export function isAgeBlocked(movie) {
  return !!(user && user.age != null && movie && movie.ageRating && user.age < movie.ageRating.minAge);
}
// ასაკობრივი შეზღუდვის შეტყობინება (ტექსტი დავალებაში მოცემულია)
export const ageBlockMessage = (movie) => `This film is rated ${movie.ageRating.code}. You cannot buy tickets for it with this account.`;

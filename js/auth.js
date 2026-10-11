// Session state: the signed-in user lives here; everything else subscribes.
import { api, setToken, getToken } from './api.js';

let user = null;
const subscribers = new Set();

export const getUser = () => user;
export const isAuthed = () => !!user;
export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
export function setUser(next) { user = next; subscribers.forEach((fn) => fn(user)); }

/** Restore the session on boot. A 401 means the stored token is stale, so drop it and carry on as a guest. */
export async function initAuth() {
  if (!getToken()) return;
  try { setUser(await api.me()); }
  catch (e) { if (e.status === 401) setToken(null); }
}

async function finish(result) { setToken(result.token); setUser(result.user); return result.user; }
export const login = async (email, password) => finish(await api.login(email, password));
export const register = async (form) => finish(await api.register(form));

export async function logout() {
  try { await api.logout(); } catch { /* clear locally regardless of the response */ }
  setToken(null);
  setUser(null);
}

/** Called when a protected request 401s: forget the dead token so the UI flips to the guest state. */
export function expireSession() { setToken(null); setUser(null); }

/** True when the signed-in user is too young for this movie. */
export function isAgeBlocked(movie) {
  return !!(user && user.age != null && movie && movie.ageRating && user.age < movie.ageRating.minAge);
}
export const ageBlockMessage = (movie) => `This film is rated ${movie.ageRating.code}. You cannot buy tickets for it with this account.`;

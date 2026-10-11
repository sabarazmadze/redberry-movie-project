// Thin fetch wrapper around the Kino XII REST API.
// - injects the bearer token
// - normalises errors into ApiError (status, message, field errors, contested seats)
// - on 401 asks the registered handler to sign the user in, then replays the request once

export const API_BASE = (window.KINO_API_BASE || 'https://api.kinoxii.redberryinternship.ge/api').replace(/\/$/, '');
const TOKEN_KEY = 'kx_token';

let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }

let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(status, data) {
    super((data && data.message) || (status === 0 ? 'Network error. Check your connection and try again.' : `Request failed (${status})`));
    this.name = 'ApiError';
    this.status = status;
    this.data = data || {};
    this.errors = (data && data.errors) || null;      // 422 field errors
    this.contested = (data && data.contested) || null; // 409 seat codes
  }
}

export const getToken = () => token;

export function setToken(value) {
  token = value || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

/** Register the function that is awaited when a protected call returns 401. It must reject if the user gives up. */
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

function buildQuery(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(`${key}[]`, v));
    else params.append(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function request(path, opts = {}) {
  const { method = 'GET', query, json, form, signal, replay401 = true, _retried = false } = opts;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  else if (form) body = form;

  let res;
  try {
    res = await fetch(API_BASE + path + buildQuery(query), { method, headers, body, signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new ApiError(0, null);
  }

  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* empty / non-JSON body */ }
  if (res.ok) return data;

  const error = new ApiError(res.status, data);
  const isAuthCall = path === '/login' || path === '/register';
  if (res.status === 401 && replay401 && !_retried && !isAuthCall && unauthorizedHandler) {
    await unauthorizedHandler(error); // throws when the user closes the login modal
    return request(path, { ...opts, _retried: true });
  }
  throw error;
}

export const isAbort = (e) => e && e.name === 'AbortError';

// ---- endpoints -------------------------------------------------------------
export const api = {
  filterOptions: () => request('/filter-options').then((r) => r.data),

  login: (email, password) => request('/login', { method: 'POST', json: { email, password } }).then((r) => r.data),
  register: (form) => request('/register', { method: 'POST', form }).then((r) => r.data),
  logout: () => request('/logout', { method: 'POST', replay401: false }),
  me: () => request('/me', { replay401: false }).then((r) => r.data),
  // The contract says PUT + multipart. PHP only parses multipart bodies on POST, so we send a method-spoofed POST
  // first and fall back to a real PUT if the server does not accept the override.
  updateProfile: async (fields) => {
    const build = (spoof) => {
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v == null ? '' : v));
      if (spoof) form.append('_method', 'PUT');
      return form;
    };
    try {
      return (await request('/profile', { method: 'POST', form: build(true) })).data;
    } catch (e) {
      if (e.status === 404 || e.status === 405) return (await request('/profile', { method: 'PUT', form: build(false) })).data;
      throw e;
    }
  },

  search: (q, signal) => request('/search', { query: { q }, signal }).then((r) => r.data),
  featured: () => request('/movies/featured').then((r) => r.data),
  nowPlaying: (limit) => request('/movies/now-playing', { query: { limit } }).then((r) => r.data),
  comingSoon: (limit) => request('/movies/coming-soon', { query: { limit } }).then((r) => r.data),
  movie: (slug) => request(`/movies/${encodeURIComponent(slug)}`).then((r) => r.data),
  movieSessions: (slug, date, signal) => request(`/movies/${encodeURIComponent(slug)}/sessions`, { query: { date }, signal }).then((r) => r.data),
  notify: (slug) => request(`/movies/${encodeURIComponent(slug)}/notify`, { method: 'POST' }).then((r) => r.data),

  sessions: (query, signal) => request('/sessions', { query, signal }),
  session: (id) => request(`/sessions/${id}`).then((r) => r.data),
  seats: (id) => request(`/sessions/${id}/seats`).then((r) => r.data),

  hold: (sessionId, seats) => request(`/sessions/${sessionId}/holds`, { method: 'POST', json: { seats } }).then((r) => r.data),
  releaseHold: (holdId) => request(`/holds/${holdId}`, { method: 'DELETE', replay401: false }),
  order: (payload) => request('/orders', { method: 'POST', json: payload }).then((r) => r.data),

  tickets: () => request('/tickets').then((r) => r.data),
  refund: (reference) => request(`/orders/${encodeURIComponent(reference)}/refund`, { method: 'POST' }).then((r) => r.data),
};

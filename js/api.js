// თხელი fetch შრე Kino XII-ის REST API-სთვის.
// - ამატებს bearer ტოკენს ყველა მოთხოვნას
// - შეცდომებს აერთიანებს ApiError-ში (სტატუსი, შეტყობინება, ველების შეცდომები, დაკავებული ადგილები)
// - 401-ის შემთხვევაში იძახებს რეგისტრირებულ დამმუშავებელს (შესვლის მოდალი) და მოთხოვნას ერთხელ იმეორებს

// API-ს საბაზო მისამართი (ტესტებში შეიძლება გადაიწეროს window.KINO_API_BASE-ით)
export const API_BASE = (window.KINO_API_BASE || 'https://api.kinoxii.redberryinternship.ge/api').replace(/\/$/, '');
// localStorage-ის გასაღები, სადაც ავტორიზაციის ტოკენი ინახება
const TOKEN_KEY = 'kx_token';

// ტოკენი მეხსიერებაშიც გვიჭირავს, რომ ყოველ მოთხოვნაზე storage არ წავიკითხოთ
let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch { /* localStorage მიუწვდომელია */ }

// ფუნქცია, რომელიც 401-ზე იძახება (იხსნება შესვლის მოდალი)
let unauthorizedHandler = null;

// API-ს შეცდომის კლასი. ინახავს HTTP სტატუსს, სერვერის შეტყობინებას და დამატებით ველებს.
// სტატუსი 0 ნიშნავს ქსელის შეცდომას (სერვერამდე მისვლა ვერ მოხერხდა).
export class ApiError extends Error {
  constructor(status, data) {
    super((data && data.message) || (status === 0 ? 'Network error. Check your connection and try again.' : `Request failed (${status})`));
    this.name = 'ApiError';
    this.status = status;
    this.data = data || {};
    this.errors = (data && data.errors) || null;      // 422: ველების მიხედვით დაჯგუფებული შეცდომები
    this.contested = (data && data.contested) || null; // 409: დაკავებული ადგილების კოდები
  }
}

// აბრუნებს მიმდინარე ტოკენს (ან null-ს)
export const getToken = () => token;

// ინახავს ან შლის ტოკენს (მეხსიერებაშიც და localStorage-შიც)
export function setToken(value) {
  token = value || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* შენახვის შეცდომას ვიგნორებთ */ }
}

/** არეგისტრირებს ფუნქციას, რომელსაც ველოდებით, როცა დაცული მოთხოვნა 401-ს აბრუნებს. თუ მომხმარებელი უარს იტყვის, ფუნქციამ უნდა დააბრუნოს reject. */
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

// query ობიექტს აქცევს სტრიქონად. მასივები იგზავნება `key[]=a&key[]=b` ფორმატით,
// ცარიელი მნიშვნელობები გამოტოვებულია.
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

// ძირითადი მოთხოვნის ფუნქცია. opts: method, query, json, form (FormData), signal (გაუქმებისთვის),
// replay401 (false-ზე 401-ის დროს შესვლის მოდალი არ იხსნება).
export async function request(path, opts = {}) {
  const { method = 'GET', query, json, form, signal, replay401 = true, _retried = false } = opts;
  // ყოველთვის JSON პასუხს ვითხოვთ; Content-Type-ს ვადგენთ მხოლოდ JSON სხეულისას (FormData-ზე ბრაუზერი თავად აყენებს boundary-ს)
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

  // 204 = სხეული არ არის (მაგ. logout, hold-ის გათავისუფლება)
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* ცარიელი ან არა-JSON პასუხი */ }
  if (res.ok) return data;

  const error = new ApiError(res.status, data);
  // login/register-ზე 401 ნიშნავს არასწორ მონაცემებს და არა ვადაგასულ სესიას, ამიტომ მათ არ ვიმეორებთ
  const isAuthCall = path === '/login' || path === '/register';
  if (res.status === 401 && replay401 && !_retried && !isAuthCall && unauthorizedHandler) {
    await unauthorizedHandler(error); // აგდებს შეცდომას, თუ მომხმარებელმა შესვლის მოდალი დახურა
    return request(path, { ...opts, _retried: true });
  }
  throw error;
}

// ამოწმებს, რომ შეცდომა მოთხოვნის განზრახ გაუქმებისგანაა (AbortController)
export const isAbort = (e) => e && e.name === 'AbortError';

// ---- ენდფოინთები ------------------------------------------------------------
export const api = {
  // ფილტრების პარამეტრები: დარბაზები, ფორმატები, ენები, ბილეთის ტიპები, ადგილების ლიმიტი და ა.შ.
  filterOptions: () => request('/filter-options').then((r) => r.data),

  // ავტორიზაცია
  login: (email, password) => request('/login', { method: 'POST', json: { email, password } }).then((r) => r.data),
  register: (form) => request('/register', { method: 'POST', form }).then((r) => r.data),
  logout: () => request('/logout', { method: 'POST', replay401: false }),
  me: () => request('/me', { replay401: false }).then((r) => r.data),
  // დოკუმენტაციის მიხედვით ეს PUT + multipart-ია. PHP multipart სხეულს მხოლოდ POST-ზე კითხულობს, ამიტომ ჯერ
  // გავგზავნით POST-ს `_method=PUT` ველით, ხოლო თუ სერვერი ამას არ იღებს, ნამდვილ PUT-ზე გადავდივართ.
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

  // ფილმების ძიება და სიები (მთავარი გვერდი)
  search: (q, signal) => request('/search', { query: { q }, signal }).then((r) => r.data),
  featured: () => request('/movies/featured').then((r) => r.data),
  nowPlaying: (limit) => request('/movies/now-playing', { query: { limit } }).then((r) => r.data),
  comingSoon: (limit) => request('/movies/coming-soon', { query: { limit } }).then((r) => r.data),
  movie: (slug) => request(`/movies/${encodeURIComponent(slug)}`).then((r) => r.data),
  movieSessions: (slug, date, signal) => request(`/movies/${encodeURIComponent(slug)}/sessions`, { query: { date }, signal }).then((r) => r.data),
  notify: (slug) => request(`/movies/${encodeURIComponent(slug)}/notify`, { method: 'POST' }).then((r) => r.data),

  // სეანსები და დარბაზის რუკა
  sessions: (query, signal) => request('/sessions', { query, signal }),
  session: (id) => request(`/sessions/${id}`).then((r) => r.data),
  seats: (id) => request(`/sessions/${id}/seats`).then((r) => r.data),

  // ადგილების დროებითი დაჯავშნა, თანხის გადახდა და შეკვეთის შექმნა
  hold: (sessionId, seats) => request(`/sessions/${sessionId}/holds`, { method: 'POST', json: { seats } }).then((r) => r.data),
  releaseHold: (holdId) => request(`/holds/${holdId}`, { method: 'DELETE', replay401: false }),
  order: (payload) => request('/orders', { method: 'POST', json: payload }).then((r) => r.data),

  // ჩემი ბილეთები და თანხის დაბრუნება
  tickets: () => request('/tickets').then((r) => r.data),
  refund: (reference) => request(`/orders/${encodeURIComponent(reference)}/refund`, { method: 'POST' }).then((r) => r.data),
};

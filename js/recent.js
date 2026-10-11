// "Recently viewed" films, kept in localStorage so it works for guests and signed-in users alike.
const KEY = 'kx_recent';
const MAX = 8;

export function getRecent() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function addRecent(movie) {
  const entry = {
    slug: movie.slug, title: movie.title, posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl,
    runtimeMinutes: movie.runtimeMinutes, ageRating: movie.ageRating, genres: (movie.genres || []).slice(0, 1),
  };
  const list = [entry, ...getRecent().filter((m) => m.slug !== movie.slug)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full / unavailable */ }
}

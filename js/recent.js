// "ბოლოს ნანახი" ფილმები ინახება localStorage-ში, ამიტომ მუშაობს სტუმრებისთვისაც და ავტორიზებულებისთვისაც.
const KEY = 'kx_recent';
// მაქსიმუმ რამდენი ფილმი ვიმახსოვროთ
const MAX = 8;

// აბრუნებს შენახულ სიას (დაზიანებული მონაცემის შემთხვევაში - ცარიელს)
export function getRecent() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

// ამატებს ფილმს სიის თავში; დუბლიკატს შლის და სიას MAX-მდე ამოკლებს. ვინახავთ მხოლოდ საჭირო ველებს.
export function addRecent(movie) {
  const entry = {
    slug: movie.slug, title: movie.title, posterUrl: movie.posterUrl, backdropUrl: movie.backdropUrl,
    runtimeMinutes: movie.runtimeMinutes, ageRating: movie.ageRating, genres: (movie.genres || []).slice(0, 1),
  };
  const list = [entry, ...getRecent().filter((m) => m.slug !== movie.slug)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* მეხსიერება სავსეა ან მიუწვდომელია */ }
}

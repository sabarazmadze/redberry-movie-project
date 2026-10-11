// აპლიკაციის შესასვლელი წერტილი: აერთიანებს API-ს, ავტორიზაციას, მარშრუტებს და გვერდის ჩარჩოს (navbar/footer)
import { onUnauthorized, ApiError } from './api.js';
import { initAuth, expireSession } from './auth.js';
import { openAuthModal } from './modals/auth.js';
import { mountShell, updateActiveLink } from './components/shell.js';
import { defineRoute, onRender, startRouter } from './router.js';

// ნებისმიერი დაცული მოთხოვნა, რომელიც 401-ს დააბრუნებს, აქ მოხვდება: ვადაგასულ ტოკენს ვშლით, მომხმარებელს ხელახლა შესვლას ვთხოვთ
// და api.request() შეწყვეტილ მოთხოვნას ერთხელ გაიმეორებს. თუ მომხმარებელი მოდალს დახურავს, მოთხოვნა reject-ით სრულდება.
let pendingLogin = null;
onUnauthorized(() => {
  if (!pendingLogin) {
    expireSession();
    pendingLogin = new Promise((resolve, reject) => {
      openAuthModal({
        mode: 'login',
        notice: 'Please log in to continue.',
        onSuccess: resolve,
        onCancel: () => reject(new ApiError(401, { message: 'Sign in required.' })),
      });
    }).finally(() => { pendingLogin = null; });
  }
  return pendingLogin;
});

// მარშრუტები: გვერდები იტვირთება დინამიურად (lazy), რომ საწყისი ჩატვირთვა მსუბუქი იყოს
defineRoute('home', '/', () => import('./pages/home.js'), { hero: true });
defineRoute('sessions', '/sessions', () => import('./pages/sessions.js'));
defineRoute('movie', '/movies/:slug', () => import('./pages/movie.js'), { hero: true });
defineRoute('profile', '/profile', () => import('./pages/profile.js'));

// ყოველი გადასვლის შემდეგ navbar-ში აქტიურ ბმულს ვანახლებთ
onRender(() => updateActiveLink());

// ჩატვირთვის თანმიმდევრობა: ჩარჩო -> სესიის აღდგენა -> როუტერის გაშვება
(async function boot() {
  mountShell();
  // სესიას პირველ გამოსახვამდე ვაღდგენთ, მაგრამ ნელი API-ს გვერდის დიდხანს დაბლოკვის უფლებას არ ვაძლევთ (მაქს. 2.5 წმ).
  await Promise.race([initAuth(), new Promise((r) => setTimeout(r, 2500))]);
  startRouter();
})();

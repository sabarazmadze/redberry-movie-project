import { onUnauthorized, ApiError } from './api.js';
import { initAuth, expireSession } from './auth.js';
import { openAuthModal } from './modals/auth.js';
import { mountShell, updateActiveLink } from './components/shell.js';
import { defineRoute, onRender, startRouter } from './router.js';

// Any protected call that 401s lands here: forget the stale token, ask the user to sign in again, and let
// api.request() replay the interrupted call once they have. If they close the modal the call rejects.
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

defineRoute('home', '/', () => import('./pages/home.js'), { hero: true });
defineRoute('sessions', '/sessions', () => import('./pages/sessions.js'));
defineRoute('movie', '/movies/:slug', () => import('./pages/movie.js'), { hero: true });
defineRoute('profile', '/profile', () => import('./pages/profile.js'));

onRender(() => updateActiveLink());

(async function boot() {
  mountShell();
  // Restore the session before the first paint, but never let a slow API block the page for long.
  await Promise.race([initAuth(), new Promise((r) => setTimeout(r, 2500))]);
  startRouter();
})();

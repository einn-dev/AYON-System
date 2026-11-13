/* ─────────────────────────────────────────────────────────────
   One login per browser TAB, kept only while the tab is open.

   Each tab keeps its login in sessionStorage, which belongs to that tab
   only, so:
     - many tabs can be signed in as different accounts at the same time;
     - a NEW tab asks to sign in (safer on shared computers);
     - reloading a tab (F5) keeps it signed in;
     - closing the tab or the browser signs it out, and nothing about the
       login stays saved on the computer.

   authService.js reads the tab's login:  sessionStorage.getItem('ayon_token')
   ───────────────────────────────────────────────────────────── */

const TOKEN = 'ayon_token';
const USER  = 'ayon_user';

const safe  = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const parse = (raw) => safe(() => JSON.parse(raw || 'null'));

/* Older versions of AYON kept the login in localStorage, which stays on the
   computer even after the browser is closed. Remove it. */
safe(() => {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(USER);
});

/* this tab's login */
export const readLogin = () => ({
  token: safe(() => sessionStorage.getItem(TOKEN)),
  user:  parse(safe(() => sessionStorage.getItem(USER))),
});

/* signed in (or chose a new password) in this tab */
export const saveLogin = (token, user) => safe(() => {
  sessionStorage.setItem(TOKEN, token);
  sessionStorage.setItem(USER, JSON.stringify(user));
});

/* name, photo or a flag of this tab's account changed */
export const saveUser = (user) => safe(() => sessionStorage.setItem(USER, JSON.stringify(user)));

/* signed out (or the login ended) in this tab; other tabs keep their accounts */
export const clearLogin = () => safe(() => {
  sessionStorage.removeItem(TOKEN);
  sessionStorage.removeItem(USER);
});
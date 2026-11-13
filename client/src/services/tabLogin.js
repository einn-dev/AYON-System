/* ─────────────────────────────────────────────────────────────
   One login per browser TAB.

   Each tab keeps its own login in sessionStorage, which belongs to that tab
   only. So one tab can be the Chairperson and another the MSIRC Director,
   and both keep working.

   localStorage keeps a copy of the LAST account that signed in on this
   browser. A new tab (or the browser opened again) starts as that account,
   so opening AYON in a new tab does not ask you to sign in again.

   Signing out only signs out that tab. A tab that signed out stays signed
   out even if you reload it, until someone signs in there again.

   authService.js reads the tab's login:  sessionStorage.getItem('ayon_token')
   ───────────────────────────────────────────────────────────── */

const TOKEN = 'ayon_token';
const USER  = 'ayon_user';
const OUT   = 'ayon_tab_signed_out';

const safe  = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const parse = (raw) => safe(() => JSON.parse(raw || 'null'));
const sameAccount = (a, b) => !!a && !!b && String(a.user_id) === String(b.user_id) && a.role === b.role;

/* runs once, when the tab opens AYON: a new tab starts as the last account that signed in */
safe(() => {
  if (sessionStorage.getItem(TOKEN) || sessionStorage.getItem(OUT)) return;
  const token = localStorage.getItem(TOKEN);
  const user  = localStorage.getItem(USER);
  if (token && user) {
    sessionStorage.setItem(TOKEN, token);
    sessionStorage.setItem(USER, user);
  }
});

/* this tab's login */
export const readLogin = () => ({
  token: safe(() => sessionStorage.getItem(TOKEN)),
  user:  parse(safe(() => sessionStorage.getItem(USER))),
});

/* signed in (or chose a new password) in this tab */
export const saveLogin = (token, user) => {
  const raw = JSON.stringify(user);
  safe(() => {
    sessionStorage.setItem(TOKEN, token);
    sessionStorage.setItem(USER, raw);
    sessionStorage.removeItem(OUT);
  });
  safe(() => {                                 // new tabs start as this account
    localStorage.setItem(TOKEN, token);
    localStorage.setItem(USER, raw);
  });
};

/* name, photo or a flag of this tab's account changed */
export const saveUser = (user) => {
  const raw = JSON.stringify(user);
  safe(() => sessionStorage.setItem(USER, raw));
  safe(() => {
    if (sameAccount(parse(localStorage.getItem(USER)), user)) localStorage.setItem(USER, raw);
  });
};

/* signed out (or the login ended) in this tab; other tabs keep their accounts */
export const clearLogin = () => {
  const { token, user } = readLogin();
  safe(() => {
    sessionStorage.removeItem(TOKEN);
    sessionStorage.removeItem(USER);
    sessionStorage.setItem(OUT, '1');
  });
  safe(() => {                                 // new tabs no longer start as this account
    const lastToken = localStorage.getItem(TOKEN);
    const lastUser  = parse(localStorage.getItem(USER));
    if ((token && lastToken === token) || sameAccount(lastUser, user)) {
      localStorage.removeItem(TOKEN);
      localStorage.removeItem(USER);
    }
  });
};
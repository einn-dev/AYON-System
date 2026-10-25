import API from './authService';

/* ─────────────────────────────────────────────────────────────
   When the server says "this login is no longer valid" (the account was
   deactivated, the role changed, an Admin ended the session, or the login
   expired), clear the saved login and send the person to the sign-in page
   with a short explanation.

   This file only needs to be imported once (AuthContext.jsx does it).
   ───────────────────────────────────────────────────────────── */

const SESSION_ENDED = {
  ACCOUNT_DEACTIVATED: 'Your account has been deactivated. Please contact the MSRIC office.',
  ACCOUNT_NOT_FOUND:   'Your account could not be found. Please contact the MSRIC office.',
  SESSION_REVOKED:     'Your session was ended. Please sign in again.',
  ROLE_CHANGED:        'Your role was changed by an administrator. Please sign in again.',
  TOKEN_INVALID:       'Your session expired. Please sign in again.',
};

export const LOGOUT_REASON_KEY = 'ayon_logout_reason';

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;

    if (code && SESSION_ENDED[code]) {
      try {
        localStorage.removeItem('ayon_token');
        localStorage.removeItem('ayon_user');
        sessionStorage.setItem(LOGOUT_REASON_KEY, SESSION_ENDED[code]);
      } catch {
        /* private mode: nothing to save, still redirect */
      }
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  }
);
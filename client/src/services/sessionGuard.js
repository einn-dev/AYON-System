import API from './authService';

/* ─────────────────────────────────────────────────────────────
   When the server says "this login is no longer valid" (the account was
   deactivated, the role changed, an Admin ended the session, or the login
   expired), clear the saved login and send the person to the sign-in page
   with a short explanation.

   When the server says "you must choose a new password first" (after an
   Admin reset), keep the login and send the person to the change-password page.

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

/* These calls are made by people who are NOT signed in (sign-in form, e-mail links),
   so a "bad token" answer to them must never sign anybody out. For example an
   old verification link answers with code TOKEN_INVALID. */
const PUBLIC_CALL = /\/auth\/(login|register|verify-email|resend-verification|forgot-password|reset-password)\/?$/;

const wasSignedInCall = (config) => {
  const h = config?.headers;
  const auth = h && (h.Authorization || (typeof h.get === 'function' && h.get('Authorization')));
  return !!auth && !PUBLIC_CALL.test(String(config?.url || ''));
};

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;

    if (code === 'PASSWORD_CHANGE_REQUIRED' && wasSignedInCall(error.config)) {
      try {
        const saved = JSON.parse(localStorage.getItem('ayon_user') || 'null');
        if (saved) {
          saved.must_change_password = true;
          localStorage.setItem('ayon_user', JSON.stringify(saved));
        }
      } catch { /* ignore */ }
      if (window.location.pathname !== '/change-password') {
        window.location.assign('/change-password');
      }
    } else if (code && SESSION_ENDED[code] && wasSignedInCall(error.config)) {
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
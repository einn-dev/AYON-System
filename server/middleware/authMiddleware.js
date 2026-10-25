const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');

/* ─────────────────────────────────────────────────────────────
   verifyToken checks the DATABASE too, not just the token.

   A login token is valid for hours, so without this a person who was
   deactivated (or demoted, or whose password was reset) could keep using
   the system until the token ran out. On every request we confirm:
     1) the account still exists and is active,
     2) the role in the token is still the person's role,
     3) the token was not issued before an Admin revoked sessions,
     4) the person is not in the middle of a REQUIRED password change
        (after an Admin reset). Until they choose a new password, the only
        thing they may do is change their password.

   To keep the server fast, the answer is remembered for a few seconds.
   When an account changes, forgetUser() clears that memory, so the change
   takes effect on the very next click.
   ───────────────────────────────────────────────────────────── */

const CACHE_MS = 10 * 1000;
const cache = new Map();             // user_id -> { at, row }
let newColumnsMissing = false;       // true if the password SQL file was not run yet

const forgetUser = (userId) => { cache.delete(String(userId)); };

const loadAccount = async (userId) => {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;

  const base = 'user_id, first_name, last_name, is_active, user_roles!user_roles_user_id_fkey ( role_type )';
  const run  = (cols) => supabase.from('users').select(cols).eq('user_id', userId).maybeSingle();

  let { data, error } = await run(newColumnsMissing ? base : `${base}, sessions_revoked_at, must_change_password`);

  // the new columns aren't in the database yet: carry on without them
  if (error && !newColumnsMissing && /sessions_revoked_at|must_change_password/.test(error.message || '')) {
    newColumnsMissing = true;
    ({ data, error } = await run(base));
  }
  if (error) throw error;
  if (!data) return null;

  const row = {
    first_name: data.first_name,
    last_name:  data.last_name,
    is_active:  data.is_active !== false,
    role:       data.user_roles?.[0]?.role_type || 'researcher',
    revokedAt:  data.sessions_revoked_at ? new Date(data.sessions_revoked_at).getTime() : null,
    mustChange: data.must_change_password === true,
  };

  if (cache.size > 5000) cache.clear();
  cache.set(key, { at: Date.now(), row });
  return row;
};

const deny = (res, status, message, code) => res.status(status).json({ message, code });

/* While a password change is required, only this request is allowed through. */
const isChangePasswordRequest = (req) =>
  req.method === 'POST' &&
  String(req.originalUrl || '').split('?')[0].replace(/\/+$/, '').endsWith('/auth/change-password');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return deny(res, 403, 'Invalid or expired token.', 'TOKEN_INVALID');
  }

  try {
    const account = await loadAccount(decoded.user_id);

    if (!account) {
      return deny(res, 401, 'This account no longer exists.', 'ACCOUNT_NOT_FOUND');
    }
    if (!account.is_active) {
      return deny(res, 401, 'Your account has been deactivated.', 'ACCOUNT_DEACTIVATED');
    }
    if (account.revokedAt && decoded.iat < Math.floor(account.revokedAt / 1000)) {
      return deny(res, 401, 'Your session has ended. Please sign in again.', 'SESSION_REVOKED');
    }
    if (account.role !== decoded.role) {
      return deny(res, 401, 'Your role was changed. Please sign in again.', 'ROLE_CHANGED');
    }
    if (account.mustChange && !isChangePasswordRequest(req)) {
      return deny(res, 403, 'You must choose a new password before you continue.', 'PASSWORD_CHANGE_REQUIRED');
    }

    // the database is the source of truth for who this is
    req.user = {
      ...decoded,
      role:       account.role,
      first_name: account.first_name,
      last_name:  account.last_name,
      must_change_password: account.mustChange,
    };
    return next();
  } catch (err) {
    console.error('Auth check failed:', err.message || err);
    return deny(res, 503, 'The server is busy. Please try again in a moment.', 'AUTH_CHECK_FAILED');
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles, forgetUser };
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');

/* ─────────────────────────────────────────────────────────────
   verifyToken now checks the DATABASE too, not just the token.

   A login token is valid for hours, so without this a person who was
   deactivated (or demoted, or whose password was reset) could keep using
   the system until the token ran out. Now, on every request we confirm:
     1) the account still exists and is active,
     2) the role in the token is still the person's role,
     3) the token was not issued before an Admin revoked sessions.

   To keep the server fast, the answer is remembered for a few seconds.
   When an Admin changes an account, forgetUser() clears that memory, so
   the change takes effect on the very next click.
   ───────────────────────────────────────────────────────────── */

const CACHE_MS = 10 * 1000;
const cache = new Map();             // user_id -> { at, row }
let revokeColumnMissing = false;     // true if add_session_revocation.sql was not run yet

const forgetUser = (userId) => { cache.delete(String(userId)); };

const loadAccount = async (userId) => {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;

  const base = 'user_id, first_name, last_name, is_active, user_roles!user_roles_user_id_fkey ( role_type )';
  const run  = (cols) => supabase.from('users').select(cols).eq('user_id', userId).maybeSingle();

  let { data, error } = await run(revokeColumnMissing ? base : `${base}, sessions_revoked_at`);

  // the new column isn't in the database yet: carry on without it
  if (error && !revokeColumnMissing && /sessions_revoked_at/.test(error.message || '')) {
    revokeColumnMissing = true;
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
  };

  if (cache.size > 5000) cache.clear();
  cache.set(key, { at: Date.now(), row });
  return row;
};

const deny = (res, status, message, code) => res.status(status).json({ message, code });

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

    // the database is the source of truth for who this is
    req.user = {
      ...decoded,
      role:       account.role,
      first_name: account.first_name,
      last_name:  account.last_name,
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
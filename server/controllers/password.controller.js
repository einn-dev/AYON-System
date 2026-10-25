const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { logAudit, fullName } = require('../utils/audit');
const {
  RESET_TTL_MS, newToken, hashToken, sendPasswordResetEmail,
} = require('../utils/verification');
const { forgetUser } = require('../middleware/authMiddleware');

/* ═════════════════════════════════════════════════════════════
   Password management
     POST /api/auth/change-password   (signed in)  My Profile + forced change
     POST /api/auth/forgot-password   (public)     emails a reset link
     POST /api/auth/reset-password    (public)     the page the link opens
   ═════════════════════════════════════════════════════════════ */

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;                    // bcrypt only reads the first 72 characters
const RESEND_WAIT_MS = 60 * 1000;         // at least 1 minute between reset emails to one address
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Returns a message when the new password is not acceptable, otherwise null. */
const passwordProblem = (pw) => {
  if (typeof pw !== 'string' || pw.length < MIN_LENGTH) {
    return `New password must be at least ${MIN_LENGTH} characters.`;
  }
  if (pw.length > MAX_LENGTH) {
    return `New password must be ${MAX_LENGTH} characters or fewer.`;
  }
  return null;
};

/* The ONE place that saves a new password.
   It also ends every other login of that person (sessions_revoked_at), cancels any
   pending reset link, and clears the "must change password" flag. */
const saveNewPassword = async (userId, plain) => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({
      password:              await bcrypt.hash(plain, 10),
      must_change_password:  false,
      password_reset_hash:   null,
      password_reset_expires: null,
      password_changed_at:   now,
      sessions_revoked_at:   now,
    })
    .eq('user_id', userId);
  if (error) throw error;
  forgetUser(userId);
};

/* ── CHANGE PASSWORD (signed in) ──
   Needs the CURRENT password, so a stranger at a computer someone left signed in
   can't take over the account. The person stays signed in on this device: they get
   a fresh login token, every other device is signed out.                          */
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body || {};

  if (!current_password || typeof current_password !== 'string') {
    return res.status(400).json({ message: 'Please enter your current password.' });
  }
  const problem = passwordProblem(new_password);
  if (problem) return res.status(400).json({ message: problem });

  if (new_password === current_password) {
    return res.status(400).json({ message: 'Your new password must be different from the current one.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, avatar_url, password')
      .eq('user_id', req.user.user_id)
      .maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const matches = await bcrypt.compare(current_password, user.password);
    if (!matches) {
      return res.status(400).json({
        message: 'Your current password is incorrect.',
        code: 'WRONG_PASSWORD',
      });
    }

    await saveNewPassword(user.user_id, new_password);

    await logAudit(req, {
      action:     'password_changed',
      targetType: 'user',
      targetId:   user.user_id,
      targetName: fullName(user),
      details:    { forced: !!req.user.must_change_password },
    });

    const role  = req.user.role;
    const token = jwt.sign(
      {
        user_id:    user.user_id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      message: 'Your password was changed.',
      token,
      user: {
        user_id:    user.user_id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        avatar_url: user.avatar_url || null,
        role,
        must_change_password: false,
      },
    });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── FORGOT PASSWORD (public) ──
   Always gives the same answer, so nobody can use this to find out which
   emails have accounts. The email is sent after we answer.                 */
const forgotPassword = async (req, res) => {
  const emailLc = String((req.body || {}).email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(emailLc)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const generic = {
    message: 'If this email has an AYON account, a reset link has been sent. Please check your inbox and spam folder.',
  };

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name, is_active, email_verified, password_reset_expires')
      .eq('email', emailLc)
      .maybeSingle();
    if (error) throw error;

    // reset_expires = (time the email was sent) + TTL, so we can work back to when it was sent
    const sentAt = user?.password_reset_expires
      ? new Date(user.password_reset_expires).getTime() - RESET_TTL_MS
      : 0;
    const tooSoon = Date.now() - sentAt < RESEND_WAIT_MS;

    // deactivated accounts and accounts that never verified their email get no link
    if (user && user.is_active !== false && user.email_verified !== false && !tooSoon) {
      const token = newToken();

      const { error: updErr } = await supabase
        .from('users')
        .update({
          password_reset_hash:    hashToken(token),
          password_reset_expires: new Date(Date.now() + RESET_TTL_MS).toISOString(),
        })
        .eq('user_id', user.user_id);
      if (updErr) throw updErr;

      logAudit(req, {
        action:     'password_reset_requested',
        actor:      { user_id: user.user_id, name: fullName(user), role: null },
        targetType: 'user',
        targetId:   user.user_id,
        targetName: fullName(user),
      });

      Promise.resolve()
        .then(() => sendPasswordResetEmail({ email: user.email, first_name: user.first_name }, token))
        .catch((e) => console.error('Background reset email failed:', e.message || e));
    }

    return res.status(200).json(generic);
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── RESET PASSWORD (public: the page the emailed link opens) ── */
const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};

  const badLink = () => res.status(400).json({
    message: 'This reset link is invalid or has already been used. Please request a new one.',
    code: 'RESET_LINK_INVALID',
  });

  if (!token || typeof token !== 'string') return badLink();

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        user_id, first_name, last_name, password, is_active, password_reset_expires,
        user_roles!user_roles_user_id_fkey ( role_type )
      `)
      .eq('password_reset_hash', hashToken(token))
      .maybeSingle();
    if (error) throw error;

    if (!user || user.is_active === false) return badLink();

    if (!user.password_reset_expires || new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({
        message: 'This reset link has expired. Please request a new one.',
        code: 'RESET_LINK_EXPIRED',
      });
    }

    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });

    if (await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ message: 'Please choose a password different from your current one.' });
    }

    await saveNewPassword(user.user_id, password);

    await logAudit(req, {
      action:     'password_reset_completed',
      actor:      { user_id: user.user_id, name: fullName(user), role: user.user_roles?.[0]?.role_type || 'researcher' },
      targetType: 'user',
      targetId:   user.user_id,
      targetName: fullName(user),
    });

    return res.status(200).json({ message: 'Your password was changed. Please sign in with your new password.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

module.exports = { changePassword, forgotPassword, resetPassword, MIN_LENGTH, MAX_LENGTH };
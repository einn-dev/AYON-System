const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const supabase = require('../config/supabase');
const { sendEmail, emailTemplate } = require('../utils/mailer');

const TOKEN_TTL_MS   = 24 * 60 * 60 * 1000;  // verification link is valid for 24 hours
const RESEND_WAIT_MS = 60 * 1000;            // at least 1 minute between emails to the same address

/* ── Token helpers ──
   The raw token only ever lives in the email link.
   The database stores a SHA-256 hash of it, so a leaked database
   can't be used to verify accounts.                                  */
const newToken  = () => crypto.randomBytes(32).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const escapeHtml = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Public address of the website, used to build the link in the email.
   Set APP_URL on Render, e.g. https://ayon-system.vercel.app            */
const appUrl = () => {
  const raw = process.env.APP_URL
    || (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0];
  return raw.trim().replace(/\/+$/, '');
};

/* verification_expires = (time the email was sent) + TTL,
   so we can work backwards to know when it was last sent.               */
const sentTooRecently = (expires) => {
  if (!expires) return false;
  const sentAt = new Date(expires).getTime() - TOKEN_TTL_MS;
  return Date.now() - sentAt < RESEND_WAIT_MS;
};

const sendVerificationEmail = (user, token) => {
  const link = `${appUrl()}/verify-email?token=${token}`;
  const message = `
    Hi ${escapeHtml(user.first_name)},<br><br>
    Thank you for registering with AYON. Please confirm that this is your
    email address by clicking the button below:<br><br>
    <a href="${link}" style="display:inline-block;background:#8d1b2d;color:#ffffff;
       padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600">
       Verify my email</a><br><br>
    If the button does not work, copy and paste this link into your browser:<br>
    <span style="word-break:break-all;color:#1a3a5c">${link}</span><br><br>
    This link expires in 24 hours. If you did not create an AYON account,
    you can safely ignore this email.`;

  return sendEmail({
    to:        user.email,
    subject:   'AYON: Please verify your email address',
    html:      emailTemplate('Verify your email address', message),
    sensitive: true,   // keep the private link out of email_logs
  });
};

/* ── PUBLIC REGISTER — always creates a RESEARCHER account ──
   The account stays locked until the emailed link is clicked.          */
const register = async (req, res) => {
  const {
    email, password, first_name, last_name,
    employee_id, department, college, contact_number,
  } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const emailLc = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLc)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  try {
    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('user_id, email_verified, verification_expires')
      .eq('email', emailLc)
      .maybeSingle();

    if (findErr) throw findErr;

    // A verified account already owns this email -> not allowed
    if (existing?.email_verified) {
      return res.status(409).json({
        message: 'This email is already registered. Please sign in instead.',
      });
    }

    // An unverified sign-up exists: don't spam the inbox
    if (existing && sentTooRecently(existing.verification_expires)) {
      return res.status(429).json({
        message: 'A verification email was just sent to this address. Please wait a minute before trying again.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const token = newToken();

    const fields = {
      password:       hashedPassword,
      first_name,
      last_name,
      employee_id:    employee_id    || null,
      department:     department     || null,
      college:        college        || null,
      contact_number: contact_number || null,
      email_verified:          false,
      verification_token_hash: hashToken(token),
      verification_expires:    new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    };

    let userId;
    if (existing) {
      // An earlier sign-up with this email was never verified,
      // so this attempt replaces it (the old link stops working).
      const { error } = await supabase
        .from('users').update(fields).eq('user_id', existing.user_id);
      if (error) throw error;
      userId = existing.user_id;
    } else {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ email: emailLc, ...fields })
        .select('user_id')
        .single();
      if (error) throw error;
      userId = newUser.user_id;
    }

    /* SECURITY: public sign-ups are ALWAYS researchers. */
    const { data: roleRow } = await supabase
      .from('user_roles').select('role_id').eq('user_id', userId).maybeSingle();

    if (!roleRow) {
      const { error: roleError } = await supabase
        .from('user_roles').insert({ user_id: userId, role_type: 'researcher' });
      if (roleError) throw roleError;
    }

    const emailSent = await sendVerificationEmail({ email: emailLc, first_name }, token);

    return res.status(201).json({
      message: emailSent
        ? 'Account created. Please check your email to verify it.'
        : 'Account created, but the verification email could not be sent. Please use the resend button.',
      emailSent,
      email: emailLc,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── VERIFY EMAIL (called by the /verify-email page) ── */
const verifyEmail = async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      message: 'This verification link is incomplete. Please use the link from your email.',
      code: 'TOKEN_INVALID',
    });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email_verified, verification_expires')
      .eq('verification_token_hash', hashToken(token))
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(400).json({
        message: 'This verification link is invalid or has been replaced by a newer one.',
        code: 'TOKEN_INVALID',
      });
    }

    if (user.email_verified) {
      return res.status(200).json({ message: 'Your email is already verified. You can sign in.' });
    }

    if (!user.verification_expires || new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({
        message: 'This verification link has expired. Please request a new one.',
        code: 'TOKEN_EXPIRED',
      });
    }

    const { error: updErr } = await supabase
      .from('users')
      .update({ email_verified: true, verification_expires: null })
      .eq('user_id', user.user_id);

    if (updErr) throw updErr;

    return res.status(200).json({ message: 'Your email has been verified. You can now sign in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── RESEND VERIFICATION EMAIL ──
   Always gives the same answer, so nobody can use this
   to find out which emails have accounts.                              */
const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Please enter your email address.' });
  }

  const generic = {
    message: 'If this email has an account waiting for verification, a new link has been sent. Please check your inbox and spam folder.',
  };

  try {
    const emailLc = String(email).trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, first_name, email_verified, verification_expires')
      .eq('email', emailLc)
      .maybeSingle();

    if (error) throw error;

    if (user && !user.email_verified && !sentTooRecently(user.verification_expires)) {
      const token = newToken();

      const { error: updErr } = await supabase
        .from('users')
        .update({
          verification_token_hash: hashToken(token),
          verification_expires:    new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
        })
        .eq('user_id', user.user_id);

      if (updErr) throw updErr;

      await sendVerificationEmail({ email: emailLc, first_name: user.first_name }, token);
    }

    return res.status(200).json(generic);
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── LOGIN ──
   user_roles has TWO foreign keys to users (user_id, assigned_by),
   so the join must be disambiguated with !user_roles_user_id_fkey      */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        user_id, email, password, first_name, last_name, avatar_url, is_active, email_verified,
        user_roles!user_roles_user_id_fkey ( role_type )
      `)
      .eq('email', String(email).trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Login query error:', error);
      return res.status(500).json({ message: 'Server error. Please try again.' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Checked AFTER the password, so strangers can't probe which emails exist
    if (user.email_verified === false) {
      return res.status(403).json({
        message: 'Please verify your email address first. We sent a link to your inbox when you registered.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const role  = user.user_roles?.[0]?.role_type || 'researcher';
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

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        user_id:    user.user_id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        avatar_url: user.avatar_url || null,
        role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── GET PROFILE ── */
const getProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        user_id, email, first_name, last_name, avatar_url,
        employee_id, department, college,
        contact_number, created_at,
        user_roles!user_roles_user_id_fkey ( role_type )
      `)
      .eq('user_id', req.user.user_id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      user: { ...user, role: user.user_roles?.[0]?.role_type },
    });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── UPDATE PROFILE ── */
const updateProfile = async (req, res) => {
  const {
    first_name, last_name, department,
    college, contact_number, password,
  } = req.body;

  try {
    const updates = {};
    if (first_name)     updates.first_name     = first_name;
    if (last_name)      updates.last_name      = last_name;
    if (department)     updates.department     = department;
    if (college)        updates.college        = college;
    if (contact_number) updates.contact_number = contact_number;

    if (password && password.trim().length >= 8) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', req.user.user_id);

    if (error) throw error;

    return res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── PROFILE PICTURE ──
   The picture is saved in the same Supabase Storage bucket as the proposals,
   inside the  avatars/  folder, and only its public link is kept in users.avatar_url. */
const AVATAR_FOLDER = 'avatars/';

/* Look at the first bytes of the file, so a renamed file can't sneak in as a picture. */
const detectImageType = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
};

/* public link  ->  path inside the bucket (only for pictures this feature saved) */
const avatarPathFromUrl = (url) => {
  if (!url) return null;
  const marker = `/${process.env.SUPABASE_BUCKET}/`;
  const i = String(url).indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(String(url).slice(i + marker.length).split('?')[0]);
  return path.startsWith(AVATAR_FOLDER) ? path : null;
};

/* deleting the old picture is housekeeping: if it fails, nothing is lost */
const deleteStoredAvatar = async (url) => {
  const path = avatarPathFromUrl(url);
  if (!path) return;
  try {
    await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([path]);
  } catch (err) {
    console.warn('Could not delete old avatar:', err.message);
  }
};

/* ── UPLOAD / CHANGE PROFILE PICTURE ── */
const uploadAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please choose a picture to upload.' });
  }

  const type = detectImageType(req.file.buffer);
  if (!type) {
    return res.status(400).json({ message: 'Please choose a JPG, PNG or WEBP picture.' });
  }

  const userId = req.user.user_id;
  const bucket = process.env.SUPABASE_BUCKET;
  const path   = `${AVATAR_FOLDER}${userId}-${Date.now()}.${type.ext}`;   // new name every time, so browsers never show an old copy

  try {
    const { data: current, error: findErr } = await supabase
      .from('users').select('avatar_url').eq('user_id', userId).single();
    if (findErr) throw findErr;

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, req.file.buffer, { contentType: type.mime, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const avatar_url = urlData?.publicUrl;

    const { error: dbErr } = await supabase
      .from('users').update({ avatar_url }).eq('user_id', userId);
    if (dbErr) {
      await supabase.storage.from(bucket).remove([path]);   // don't leave an orphan file behind
      throw dbErr;
    }

    await deleteStoredAvatar(current?.avatar_url);
    return res.status(200).json({ message: 'Profile picture updated.', avatar_url });
  } catch (err) {
    console.error('Upload avatar error:', err);
    return res.status(500).json({ message: 'Could not save your picture. Please try again.' });
  }
};

/* ── REMOVE PROFILE PICTURE ── */
const removeAvatar = async (req, res) => {
  const userId = req.user.user_id;
  try {
    const { data: current, error: findErr } = await supabase
      .from('users').select('avatar_url').eq('user_id', userId).single();
    if (findErr) throw findErr;

    const { error } = await supabase
      .from('users').update({ avatar_url: null }).eq('user_id', userId);
    if (error) throw error;

    await deleteStoredAvatar(current?.avatar_url);
    return res.status(200).json({ message: 'Profile picture removed.', avatar_url: null });
  } catch (err) {
    console.error('Remove avatar error:', err);
    return res.status(500).json({ message: 'Could not remove your picture. Please try again.' });
  }
};

module.exports = {
  register, login, getProfile, updateProfile,
  verifyEmail, resendVerification,
  uploadAvatar, removeAvatar,
};
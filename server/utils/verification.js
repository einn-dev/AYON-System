const crypto = require('crypto');
const { sendEmail, emailTemplate } = require('./mailer');

/* Shared by the public register / resend flow (auth.controller.js)
   and by the Admin tools (admin.controller.js). */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;  // verification link is valid for 24 hours

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
    sensitive: true,        // keep the private link out of email_logs
    type:      'verification',
  });
};

module.exports = { TOKEN_TTL_MS, newToken, hashToken, sendVerificationEmail };
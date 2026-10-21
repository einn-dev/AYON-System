const nodemailer = require('nodemailer');
const supabase   = require('../config/supabase');

/* ── How emails are sent ──
   1) If BREVO_API_KEY is set  -> Brevo's HTTPS API. This works on Render's
      free plan, which blocks the SMTP ports (25 / 465 / 587).
   2) Otherwise                -> Gmail SMTP via Nodemailer. Fine for local
      development on your own computer.                                    */

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendViaBrevo = async ({ to, subject, html }) => {
  if (typeof fetch !== 'function') {
    throw new Error('Node 18 or newer is required for Brevo email sending.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept:         'application/json',
        'content-type': 'application/json',
        'api-key':      process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name:  process.env.BREVO_SENDER_NAME || 'AYON - MSIRC',
          email: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Brevo ${res.status}: ${detail}`);
    }
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Send an email and log it in email_logs.
 * Never throws — an email failure must not break the main flow.
 * Returns true if sent, false if not.
 * sensitive = true keeps the email body (e.g. a private link) out of the log.
 */
const sendEmail = async ({ to, subject, html, notif_id = null, sensitive = false }) => {
  const logBody = sensitive ? '[hidden: contains a private link]' : html;

  try {
    if (process.env.BREVO_API_KEY) {
      await sendViaBrevo({ to, subject, html });
    } else {
      await transporter.sendMail({
        from: `"AYON - MSIRC" <${process.env.EMAIL_USER}>`,
        to, subject, html,
      });
    }

    await supabase.from('email_logs').insert({
      notif_id, recipient_email: to, subject,
      body: logBody, status: 'sent', sent_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    await supabase.from('email_logs').insert({
      notif_id, recipient_email: to, subject,
      body: logBody, status: 'failed',
    });
    return false;
  }
};

const emailTemplate = (title, message) => `
  <div style="font-family:Segoe UI,sans-serif;max-width:560px;margin:0 auto;
    border:1px solid #e8edf2;border-radius:12px;overflow:hidden">
    <div style="background:#1a3a5c;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:2px">AYON</h1>
      <p style="color:#9db4cc;margin:4px 0 0;font-size:12px">
        MSIRC – Mindanao State University Main Campus
      </p>
    </div>
    <div style="padding:28px">
      <h2 style="color:#1a3a5c;font-size:17px;margin:0 0 12px">${title}</h2>
      <p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0">${message}</p>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e8edf2">
        <p style="color:#a0aec0;font-size:12px;margin:0">
          This is an automated message from the AYON Research Management System.
          Please log in to your account to view details.
        </p>
      </div>
    </div>
  </div>
`;

module.exports = { sendEmail, emailTemplate };
const nodemailer = require('nodemailer');
const supabase   = require('../config/supabase');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email and log it in email_logs.
 * Never throws — email failure should not break the main flow.
 */
const sendEmail = async ({ to, subject, html, notif_id = null }) => {
  try {
    await transporter.sendMail({
      from: `"AYON - MSIRC" <${process.env.EMAIL_USER}>`,
      to, subject, html,
    });
    await supabase.from('email_logs').insert({
      notif_id, recipient_email: to, subject,
      body: html, status: 'sent', sent_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    await supabase.from('email_logs').insert({
      notif_id, recipient_email: to, subject,
      body: html, status: 'failed',
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
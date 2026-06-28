// ─── Mailer ──────────────────────────────────────────────────────────────────
// Sends transactional email (currently just password-reset links) via Gmail SMTP
// using nodemailer. Configure with a Gmail address + an App Password (requires
// 2-Step Verification on the account):
//
//   GMAIL_USER=you@gmail.com
//   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx   # 16-char app password, no spaces
//   MAIL_FROM="MSR Generator <you@gmail.com>"   # optional display name
//
// When unconfigured (e.g. local dev), email is not sent — the link is logged to
// the server console instead, so the flow stays testable without credentials.

const nodemailer = require('nodemailer');

const USER = process.env.GMAIL_USER;
const PASS = process.env.GMAIL_APP_PASSWORD;
const FROM = process.env.MAIL_FROM || (USER ? `MSR Generator <${USER}>` : undefined);

const transport =
  USER && PASS
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: USER, pass: PASS } })
    : null;

const isConfigured = () => !!transport;

const resetBody = (link, ttlMinutes) => ({
  text:
    `We received a request to reset your MSR Generator password.\n\n` +
    `Reset it here (valid for ${ttlMinutes} minutes):\n${link}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.`,
  html:
    `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto">` +
    `<h2 style="color:#b5179e">Reset your password</h2>` +
    `<p>We received a request to reset your MSR Generator password.</p>` +
    `<p><a href="${link}" style="display:inline-block;background:#b5179e;color:#fff;` +
    `padding:10px 18px;border-radius:6px;text-decoration:none">Choose a new password</a></p>` +
    `<p style="color:#666;font-size:13px">This link is valid for ${ttlMinutes} minutes. ` +
    `If the button doesn't work, copy this URL into your browser:<br>` +
    `<a href="${link}">${link}</a></p>` +
    `<p style="color:#666;font-size:13px">If you didn't request this, ignore this email — ` +
    `your password won't change.</p>` +
    `</div>`,
});

// Sends a reset link to `to`. Returns { delivered } — false when email is not
// configured (link was logged instead). Throws only on an actual send failure.
const sendResetEmail = async (to, link, ttlMinutes) => {
  if (!transport) {
    console.log(`[mailer] email not configured — reset link for ${to}: ${link}`);
    return { delivered: false };
  }
  const { text, html } = resetBody(link, ttlMinutes);
  await transport.sendMail({ from: FROM, to, subject: 'Reset your MSR Generator password', text, html });
  return { delivered: true };
};

module.exports = { sendResetEmail, isConfigured };

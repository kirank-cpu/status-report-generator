// ─── Mailer ──────────────────────────────────────────────────────────────────
// Sends transactional email (password-reset links) via Brevo's HTTP API. We use
// HTTP rather than SMTP because hosts like Render's free plan block outbound SMTP
// ports (25/465/587) — an API call over HTTPS (443) is not blocked.
//
// Configure with a Brevo API key and a verified sender address (verify a single
// sender in the Brevo dashboard — no domain required):
//
//   BREVO_API_KEY=xkeysib-...
//   MAIL_FROM_EMAIL=you@gmail.com          # must be a verified Brevo sender
//   MAIL_FROM_NAME=MSR Generator           # optional display name
//
// When unconfigured (e.g. local dev), email is not sent — the link is logged to
// the server console instead, so the flow stays testable without credentials.

const API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL;
const FROM_NAME = process.env.MAIL_FROM_NAME || 'MSR Generator';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

const isConfigured = () => !!(API_KEY && FROM_EMAIL);

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

const verifyBody = (link, ttlMinutes) => ({
  text:
    `Hi there!,\n\n` +
    `Welcome to Status Report Generator!\n` +
    `Confirm your email to activate your account (link valid for ${Math.round(ttlMinutes / 60)} hours):\n${link}\n\n` +
    `After verifying, an admin will review your sign-up and grant access. ` +
    `If you didn't create this account, you can ignore this email.`,
  html:
    `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto">` +
    `<h2 style="color:#b5179e">Confirm your email</h2>` +
    `<p>Welcome to Status Report Generator! Confirm your email to activate your account.</p>` +
    `<p><a href="${link}" style="display:inline-block;background:#b5179e;color:#fff;` +
    `padding:10px 18px;border-radius:6px;text-decoration:none">Verify my email</a></p>` +
    `<p style="color:#666;font-size:13px">This link is valid for ${Math.round(ttlMinutes / 60)} hours. ` +
    `If the button doesn't work, copy this URL into your browser:<br>` +
    `<a href="${link}">${link}</a></p>` +
    `<p style="color:#666;font-size:13px">After verifying, an admin will review your sign-up and grant access.</p>` +
    `</div>`,
});

// Low-level send via Brevo. Throws on a real send failure so callers can log it.
const send = async (to, subject, text, html) => {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo send failed (${res.status}): ${detail}`);
  }
  return { delivered: true };
};

// Sends a reset link to `to`. Returns { delivered } — false when email is not
// configured (link was logged instead). Throws on an actual send failure so the
// caller can log it (the HTTP layer still returns a generic response to users).
const sendResetEmail = async (to, link, ttlMinutes) => {
  if (!isConfigured()) {
    console.log(`[mailer] email not configured — reset link for ${to}: ${link}`);
    return { delivered: false };
  }
  const { text, html } = resetBody(link, ttlMinutes);
  return send(to, 'Reset your MSR Generator password', text, html);
};

// Sends a sign-up email-verification link.
const sendVerificationEmail = async (to, link, ttlMinutes) => {
  if (!isConfigured()) {
    console.log(`[mailer] email not configured — verification link for ${to}: ${link}`);
    return { delivered: false };
  }
  const { text, html } = verifyBody(link, ttlMinutes);
  return send(to, 'Verify your MSR Generator email', text, html);
};

module.exports = { sendResetEmail, sendVerificationEmail, isConfigured };

const nodemailer = require("nodemailer");

/**
 * Sends mail via SMTP when SMTP_* env vars are set; otherwise logs the link (dev-friendly).
 */
function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass }
  });
}

function appName() {
  return process.env.APP_NAME || "Puzzle Platform";
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@localhost";
  const transport = getTransport();
  if (!transport) {
    console.log("\n[email:dev] SMTP not configured — message not sent via SMTP.");
    console.log(`[email:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { sent: false, dev: true };
  }
  await transport.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

async function sendVerificationEmail(to, token) {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = `Verify your email — ${appName()}`;
  const text = `Open this link to verify your email:\n\n${link}\n\nIf you did not sign up, ignore this message.`;
  const html = `<p>Verify your email for <strong>${appName()}</strong>.</p><p><a href="${link}">Verify email</a></p><p>Or paste: ${link}</p>`;
  return sendMail({ to, subject, text, html });
}

async function sendPasswordResetEmail(to, token) {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = `Reset your password — ${appName()}`;
  const text = `Reset your password:\n\n${link}\n\nThis link expires in 1 hour. If you did not request a reset, ignore this.`;
  const html = `<p>Reset your password for <strong>${appName()}</strong>.</p><p><a href="${link}">Reset password</a></p>`;
  return sendMail({ to, subject, text, html });
}

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail, getTransport };

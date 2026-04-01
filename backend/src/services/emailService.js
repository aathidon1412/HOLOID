const nodemailer = require("nodemailer");

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return cachedTransporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("Email service is not configured. Set SMTP_* variables to enable email notifications.");
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });

  return { skipped: false };
};

const sendAccountActivationEmail = async ({ to, accountName, activationLink }) => {
  const subject = "Account Activation";
  const text = `Hello ${accountName}, your account is ready. Activate it here: ${activationLink}`;

  return sendEmail({ to, subject, text });
};

const sendCriticalAlertEmail = async ({ to, hospitalName, bedType, remainingBeds, region }) => {
  const subject = "Critical Capacity Alert";
  const text = `Critical alert for ${hospitalName} (${region}): ${bedType} is low with ${remainingBeds} beds remaining.`;

  return sendEmail({ to, subject, text });
};

module.exports = {
  sendEmail,
  sendAccountActivationEmail,
  sendCriticalAlertEmail
};

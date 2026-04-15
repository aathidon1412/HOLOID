require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: node sendTestEmail.js <recipient-email>');
    process.exit(1);
  }

  let transporter;
  let usingEthereal = false;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_USERNAME, SMTP_PASSWORD, EMAIL_FROM } = process.env;
  const allowSelfSigned = String(process.env.SMTP_ALLOW_SELF_SIGNED || '').toLowerCase() === 'true';

  const smtpUser = SMTP_USER || SMTP_USERNAME;
  const smtpPass = SMTP_PASS || SMTP_PASSWORD;

  if (SMTP_HOST && smtpUser && smtpPass) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: allowSelfSigned ? { rejectUnauthorized: false } : undefined,
    });
    console.log('Using real SMTP transport:', SMTP_HOST);
  } else {
    usingEthereal = true;
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('No SMTP credentials found — using Ethereal test account.');
  }

  const info = await transporter.sendMail({
    from: 'HOLOID Test <no-reply@holoid.test>',
    to,
    subject: 'HOLOID — test email',
    text: 'This is a test email from HOLOID (nodemailer test account).',
    html: '<p>This is a test email from <strong>HOLOID</strong> (nodemailer test account).</p>',
  });

  console.log('Message sent:', info.messageId);
  if (usingEthereal) {
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  } else {
    console.log('Sent via real SMTP. Check recipient inbox:', to);
  }
}

main().catch((err) => {
  console.error('Failed to send test email:', err);
  process.exit(1);
});

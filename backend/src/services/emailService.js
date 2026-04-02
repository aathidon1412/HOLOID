const nodemailer = require("nodemailer");

const createTransporter = () => {
	const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

	if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
		return null;
	}

	return nodemailer.createTransport({
		host: SMTP_HOST,
		port: Number(SMTP_PORT),
		secure: Number(SMTP_PORT) === 465,
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASS,
		},
	});
};

const sendActivationEmail = async ({ to, name, activationLink }) => {
	const transporter = createTransporter();

	if (!transporter) {
		console.log(`Activation link for ${to}: ${activationLink}`);
		return;
	}

	await transporter.sendMail({
		from: process.env.EMAIL_FROM || process.env.SMTP_USER,
		to,
		subject: "Activate your HOLOID account",
		text: `Hi ${name},\n\nUse this link to activate your account:\n${activationLink}\n\nThis link expires soon.`,
		html: `
			<p>Hi ${name},</p>
			<p>Use the link below to activate your HOLOID account:</p>
			<p><a href="${activationLink}">${activationLink}</a></p>
			<p>This link expires soon.</p>
		`,
	});
};

module.exports = {
	sendActivationEmail,
};

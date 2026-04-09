const nodemailer = require("nodemailer");

const createTransporter = () => {
	const { SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD } = process.env;

	if (!SMTP_HOST || !SMTP_PORT || !SMTP_USERNAME || !SMTP_PASSWORD) {
		return null;
	}

	return nodemailer.createTransport({
		host: SMTP_HOST,
		port: Number(SMTP_PORT),
		secure: Number(SMTP_PORT) === 465,
		auth: {
			user: SMTP_USERNAME,
			pass: SMTP_PASSWORD,
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
		from: process.env.EMAIL_FROM || process.env.SMTP_USERNAME,
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

	return { skipped: false };
};

const sendAccountActivationEmail = async ({ to, accountName, activationLink }) =>
	sendActivationEmail({ to, name: accountName, activationLink });

const sendCriticalAlertEmail = async ({ to, hospitalName, bedType, remainingBeds, region }) => {
	const transporter = createTransporter();

	if (!transporter) {
		console.log(
			`Critical alert for ${hospitalName} (${region}) - ${bedType}: ${remainingBeds} left. Notified: ${to}`
		);
		return { skipped: true };
	}

	await transporter.sendMail({
		from: process.env.EMAIL_FROM || process.env.SMTP_USERNAME,
		to,
		subject: `Critical Bed Alert - ${hospitalName}`,
		text: `Critical bed alert\nHospital: ${hospitalName}\nRegion: ${region}\nBed Type: ${bedType}\nRemaining Beds: ${remainingBeds}`,
		html: `
			<p><strong>Critical bed alert</strong></p>
			<p>Hospital: <strong>${hospitalName}</strong></p>
			<p>Region: ${region}</p>
			<p>Bed Type: ${bedType}</p>
			<p>Remaining Beds: <strong>${remainingBeds}</strong></p>
		`,
	});

	return { skipped: false };
};

const sendTransferEventEmail = async ({
	to,
	transferId,
	status,
	patientName,
	fromHospitalName,
	toHospitalName,
	note,
	route
}) => {
	const transporter = createTransporter();

	const routeText = route
		? `Distance: ${route.distanceKm} km, ETA: ${route.durationMin} min (${route.source})`
		: "Route metadata unavailable";

	if (!transporter) {
		console.log(
			`Transfer ${status}: ${transferId} patient=${patientName} ${fromHospitalName} -> ${toHospitalName}. Notified: ${to}`
		);
		return { skipped: true };
	}

	await transporter.sendMail({
		from: process.env.EMAIL_FROM || process.env.SMTP_USERNAME,
		to,
		subject: `Transfer ${status.toUpperCase()} - ${patientName}`,
		text: [
			`Transfer ID: ${transferId}`,
			`Patient: ${patientName}`,
			`Status: ${status}`,
			`From: ${fromHospitalName}`,
			`To: ${toHospitalName}`,
			note ? `Note: ${note}` : null,
			routeText
		]
			.filter(Boolean)
			.join("\n"),
		html: `
			<p><strong>Transfer update</strong></p>
			<p>Transfer ID: <strong>${transferId}</strong></p>
			<p>Patient: ${patientName}</p>
			<p>Status: <strong>${status}</strong></p>
			<p>From: ${fromHospitalName}</p>
			<p>To: ${toHospitalName}</p>
			${note ? `<p>Note: ${note}</p>` : ""}
			<p>${routeText}</p>
		`,
	});

	return { skipped: false };
};

module.exports = {
	sendActivationEmail,
	sendAccountActivationEmail,
	sendCriticalAlertEmail,
	sendTransferEventEmail,
};

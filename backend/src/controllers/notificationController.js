const {
  sendAccountActivationEmail,
  sendCriticalAlertEmail
} = require("../services/emailService");

const sendAccountActivation = async (req, res) => {
  const { to, accountName, activationLink } = req.body;

  if (!to || !accountName || !activationLink) {
    return res.status(400).json({
      message: "to, accountName and activationLink are required"
    });
  }

  const result = await sendAccountActivationEmail({ to, accountName, activationLink });

  return res.status(200).json({
    message: result.skipped ? "Email service not configured" : "Activation email sent"
  });
};

const sendCriticalAlert = async (req, res) => {
  const { to, hospitalName, bedType, remainingBeds, region } = req.body;

  if (!to || !hospitalName || !bedType || Number.isNaN(Number(remainingBeds)) || !region) {
    return res.status(400).json({
      message: "to, hospitalName, bedType, remainingBeds and region are required"
    });
  }

  const result = await sendCriticalAlertEmail({
    to,
    hospitalName,
    bedType,
    remainingBeds: Number(remainingBeds),
    region
  });

  return res.status(200).json({
    message: result.skipped ? "Email service not configured" : "Critical alert email sent"
  });
};

module.exports = {
  sendAccountActivation,
  sendCriticalAlert
};

const {
  sendAccountActivationEmail,
  sendCriticalAlertEmail
} = require("../services/emailService");
const {
  getPushPublicKey,
  registerPushSubscription,
  unregisterPushSubscription
} = require("../services/pushService");

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

const getPushVapidPublicKey = async (_req, res) => {
  const publicKey = getPushPublicKey();
  return res.status(200).json({ publicKey, enabled: Boolean(publicKey) });
};

const subscribePushAlerts = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return res.status(400).json({ message: "Valid push subscription is required" });
  }

  const record = await registerPushSubscription({
    userId,
    hospitalId: req.user?.hospital || null,
    subscription,
    userAgent: req.headers["user-agent"]
  });

  return res.status(200).json({
    message: "Push subscription registered",
    subscriptionId: String(record._id)
  });
};

const unsubscribePushAlerts = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const endpoint = String(req.body?.endpoint || "").trim();
  if (!endpoint) {
    return res.status(400).json({ message: "endpoint is required" });
  }

  await unregisterPushSubscription({ userId, endpoint });

  return res.status(200).json({ message: "Push subscription removed" });
};

module.exports = {
  sendAccountActivation,
  sendCriticalAlert,
  getPushVapidPublicKey,
  subscribePushAlerts,
  unsubscribePushAlerts
};

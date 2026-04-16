const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const {
  sendAccountActivation,
  sendCriticalAlert,
  getPushVapidPublicKey,
  subscribePushAlerts,
  unsubscribePushAlerts
} = require("../controllers/notificationController");

const router = express.Router();

router.post("/account-activation", sendAccountActivation);
router.post("/critical-alert", sendCriticalAlert);
router.get("/push/public-key", getPushVapidPublicKey);
router.post("/push/subscribe", authenticate, subscribePushAlerts);
router.delete("/push/subscribe", authenticate, unsubscribePushAlerts);

module.exports = router;

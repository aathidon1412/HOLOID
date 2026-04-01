const express = require("express");
const {
  sendAccountActivation,
  sendCriticalAlert
} = require("../controllers/notificationController");

const router = express.Router();

router.post("/account-activation", sendAccountActivation);
router.post("/critical-alert", sendCriticalAlert);

module.exports = router;

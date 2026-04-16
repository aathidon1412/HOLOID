const express = require("express");
const {
  getRegionOccupancySummary,
  listCriticalHospitals,
  listTransferHistory,
  listAuditLogs,
  listLiveFleet
} = require("../controllers/commandCenterController");

const router = express.Router();

router.get("/regions/occupancy", getRegionOccupancySummary);
router.get("/hospitals/critical", listCriticalHospitals);
router.get("/transfers/history", listTransferHistory);
router.get("/audit-logs", listAuditLogs);
router.get("/fleet/live", listLiveFleet);

module.exports = router;

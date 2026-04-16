const express = require("express");
const {
  getRegionOccupancySummary,
  listCriticalHospitals,
  listTransferHistory,
  listAuditLogs,
  listTransferMetrics
} = require("../controllers/commandCenterController");

const router = express.Router();

router.get("/regions/occupancy", getRegionOccupancySummary);
router.get("/hospitals/critical", listCriticalHospitals);
router.get("/transfers/history", listTransferHistory);
router.get("/transfers/metrics", listTransferMetrics);
router.get("/audit-logs", listAuditLogs);

module.exports = router;

const express = require("express");
const {
  searchHospitalsByResource,
  getNearestHospitalWithRequiredBed,
  requestPatientTransfer,
  getTransferHistory,
  trackTransfer,
  updateTransferStatus,
  updateHospitalResources
} = require("../controllers/logisticsController");

const router = express.Router();

router.get("/hospitals/search", searchHospitalsByResource);
router.get("/hospitals/nearest", getNearestHospitalWithRequiredBed);
router.get("/history", getTransferHistory);
router.post("/transfer", requestPatientTransfer);
router.post("/transfers", requestPatientTransfer);
router.get("/transfers/:transferId", trackTransfer);
router.patch("/transfer/:transferId/accept", (req, _res, next) => {
  req.body = { ...(req.body || {}), status: "Accepted" };
  next();
});
router.patch("/transfer/:transferId", updateTransferStatus);
router.patch("/transfers/:transferId/status", updateTransferStatus);
router.patch("/hospitals/:hospitalId/resources", updateHospitalResources);

module.exports = router;

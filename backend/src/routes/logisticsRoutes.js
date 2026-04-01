const express = require("express");
const {
  searchHospitalsByResource,
  getNearestHospitalWithRequiredBed,
  requestPatientTransfer,
  trackTransfer,
  updateTransferStatus,
  updateHospitalResources
} = require("../controllers/logisticsController");

const router = express.Router();

router.get("/hospitals/search", searchHospitalsByResource);
router.get("/hospitals/nearest", getNearestHospitalWithRequiredBed);
router.post("/transfers", requestPatientTransfer);
router.get("/transfers/:transferId", trackTransfer);
router.patch("/transfers/:transferId/status", updateTransferStatus);
router.patch("/hospitals/:hospitalId/resources", updateHospitalResources);

module.exports = router;

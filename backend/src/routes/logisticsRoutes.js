const express = require("express");
const {
  searchHospitalsByResource,
  getNearestHospitalWithRequiredBed,
  requestPatientTransfer,
  listOpenTransfersForHospital,
  listHospitalBedSlots,
  assignPatientToBedSlot,
  releaseBedSlot,
  updateBedSlotStatus,
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
router.get("/hospitals/:hospitalId/transfers/open", listOpenTransfersForHospital);
router.get("/hospitals/:hospitalId/bed-slots", listHospitalBedSlots);
router.post("/hospitals/:hospitalId/bed-slots/:slotId/assign", assignPatientToBedSlot);
router.patch("/hospitals/:hospitalId/bed-slots/:slotId/release", releaseBedSlot);
router.patch("/hospitals/:hospitalId/bed-slots/:slotId/status", updateBedSlotStatus);

module.exports = router;

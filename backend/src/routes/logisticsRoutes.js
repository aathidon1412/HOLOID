const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const ROLES = require("../utils/roles");
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
  listHospitalAmbulances,
  createHospitalAmbulance,
  updateHospitalAmbulance,
  assignTransferDispatch,
  listDriverDispatches,
  respondToDriverDispatch,
  updateDriverDispatchProgress,
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

router.get(
  "/hospitals/:hospitalId/ambulances",
  authenticate,
  authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
  listHospitalAmbulances
);
router.post(
  "/hospitals/:hospitalId/ambulances",
  authenticate,
  authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
  createHospitalAmbulance
);
router.patch(
  "/hospitals/:hospitalId/ambulances/:ambulanceId",
  authenticate,
  authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
  updateHospitalAmbulance
);

router.post(
  "/transfers/:transferId/dispatch/assign",
  authenticate,
  authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
  assignTransferDispatch
);

router.get(
  "/drivers/me/dispatches",
  authenticate,
  authorizeRoles(ROLES.AMBULANCE_DRIVER),
  listDriverDispatches
);
router.patch(
  "/drivers/me/dispatches/:transferId/respond",
  authenticate,
  authorizeRoles(ROLES.AMBULANCE_DRIVER),
  respondToDriverDispatch
);
router.patch(
  "/drivers/me/dispatches/:transferId/progress",
  authenticate,
  authorizeRoles(ROLES.AMBULANCE_DRIVER),
  updateDriverDispatchProgress
);

module.exports = router;

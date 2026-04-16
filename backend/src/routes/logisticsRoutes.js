const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const ROLES = require("../utils/roles");
const {
  searchHospitalsByResource,
  getNearestHospitalWithRequiredBed,
  lookupPatientByPatientId,
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
  updateDriverLocation,
  updateHospitalResources
} = require("../controllers/logisticsController");

const router = express.Router();

router.get("/hospitals/search", searchHospitalsByResource);
router.get("/hospitals/nearest", getNearestHospitalWithRequiredBed);
router.get(
  "/patients/lookup",
  authenticate,
  authorizeRoles(
    ROLES.DOCTOR,
    ROLES.HOSPITAL_ADMIN,
    ROLES.BED_MANAGER,
    ROLES.DATA_ENTRY,
    ROLES.GOVERNMENT_OFFICIAL
  ),
  lookupPatientByPatientId
);
router.get("/history", authenticate, getTransferHistory);
router.post(
  "/transfer",
  authenticate,
  authorizeRoles(
    ROLES.DOCTOR,
    ROLES.HOSPITAL_ADMIN,
    ROLES.BED_MANAGER,
    ROLES.DATA_ENTRY,
    ROLES.GOVERNMENT_OFFICIAL
  ),
  requestPatientTransfer
);
router.post(
  "/transfers",
  authenticate,
  authorizeRoles(
    ROLES.DOCTOR,
    ROLES.HOSPITAL_ADMIN,
    ROLES.BED_MANAGER,
    ROLES.DATA_ENTRY,
    ROLES.GOVERNMENT_OFFICIAL
  ),
  requestPatientTransfer
);
router.get("/transfers/:transferId", trackTransfer);
router.patch(
  "/transfer/:transferId/accept",
  authenticate,
  authorizeRoles(ROLES.HOSPITAL_ADMIN, ROLES.GOVERNMENT_OFFICIAL),
  (req, _res, next) => {
    req.body = {
      ...(req.body || {}),
      status: "Accepted",
      actor: {
        role: req.user?.role || "HOSPITAL_ADMIN",
        id: req.user?.id || "",
        name: req.user?.name || "",
      },
    };
    next();
  },
  updateTransferStatus
);
router.patch(
  "/transfer/:transferId",
  authenticate,
  authorizeRoles(ROLES.HOSPITAL_ADMIN, ROLES.BED_MANAGER, ROLES.GOVERNMENT_OFFICIAL),
  updateTransferStatus
);
router.patch(
  "/transfers/:transferId/status",
  authenticate,
  authorizeRoles(ROLES.HOSPITAL_ADMIN, ROLES.BED_MANAGER, ROLES.GOVERNMENT_OFFICIAL),
  updateTransferStatus
);
router.patch("/hospitals/:hospitalId/resources", updateHospitalResources);
router.get(
  "/hospitals/:hospitalId/transfers/open",
  authenticate,
  authorizeRoles(ROLES.HOSPITAL_ADMIN, ROLES.BED_MANAGER, ROLES.DOCTOR, ROLES.GOVERNMENT_OFFICIAL),
  listOpenTransfersForHospital
);
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
router.patch(
  "/drivers/me/dispatches/:transferId/location",
  authenticate,
  authorizeRoles(ROLES.AMBULANCE_DRIVER),
  updateDriverLocation
);

module.exports = router;

const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { createHospital, listHospitals, getHospital, updateHospital, deleteHospital } = require("../controllers/hospitalController");
const ROLES = require("../utils/roles");

const router = express.Router();

// Create hospital — only government officials
router.post("/", authenticate, authorizeRoles(ROLES.GOVERNMENT_OFFICIAL), createHospital);

// List hospitals (for dropdown) - public so registration can fetch
router.get("/list", listHospitals);

// Get single hospital
router.get("/:id", authenticate, authorizeRoles(ROLES.GOVERNMENT_OFFICIAL), getHospital);

// Update hospital (gov or hospital admin)
router.put("/:id", authenticate, authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN), updateHospital);

// Delete (soft) hospital (gov only)
router.delete("/:id", authenticate, authorizeRoles(ROLES.GOVERNMENT_OFFICIAL), deleteHospital);

module.exports = router;

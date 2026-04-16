const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { approveUser, rejectUser, listPendingUsers, listAllUsers, toggleUserStatus } = require("../controllers/userController");
const ROLES = require("../utils/roles");

const router = express.Router();

// Approve a pending user (gov approves hospital admins, hospital admin approves doctors)
router.post(
    "/:id/approve",
    authenticate,
    authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
    approveUser
);

// Reject a pending user with reason (gov rejects hospital admins, hospital admin rejects operational roles)
router.post(
    "/:id/reject",
    authenticate,
    authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
    rejectUser
);

// List pending users for approval
router.get(
    "/pending",
    authenticate,
    authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
    listPendingUsers
);

// List all users in system (for user management)
router.get(
    "/",
    authenticate,
    authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
    listAllUsers
);

// Toggle active/inactive status
router.put(
    "/:id/status",
    authenticate,
    authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
    toggleUserStatus
);

module.exports = router;

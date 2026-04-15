const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const { approveUser, listPendingUsers } = require("../controllers/userController");
const ROLES = require("../utils/roles");

const router = express.Router();

// Approve a pending user (gov approves hospital admins, hospital admin approves doctors)
router.post(
    "/:id/approve",
    authenticate,
    authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
    approveUser
);

// List pending users for approval
router.get(
    "/pending",
    authenticate,
    authorizeRoles(ROLES.GOVERNMENT_OFFICIAL, ROLES.HOSPITAL_ADMIN),
    listPendingUsers
);

router.get("/", authenticate, (req, res) => {
    res.status(200).json({ message: "User routes placeholder" });
});

module.exports = router;

const express = require("express");
const { body, validationResult } = require("express-validator");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbacMiddleware");
const {
    getMyProfile,
    updateMyProfile,
    changeMyPassword,
    approveUser,
    rejectUser,
    listPendingUsers,
    listAllUsers,
    toggleUserStatus,
} = require("../controllers/userController");
const ROLES = require("../utils/roles");

const router = express.Router();

const validate = (checks) => async (req, res, next) => {
    await Promise.all(checks.map((c) => c.run(req)));
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: errors.array()[0]?.msg || "Validation failed",
            },
        });
    }

    next();
};

router.get("/me", authenticate, getMyProfile);

router.patch(
    "/me",
    authenticate,
    validate([
        body("name").optional().isString().trim().isLength({ min: 2, max: 80 }).withMessage("Name must be between 2 and 80 characters"),
        body("email").optional().isEmail().withMessage("Please provide a valid email address"),
    ]),
    updateMyProfile
);

router.patch(
    "/me/password",
    authenticate,
    validate([
        body("currentPassword").isString().notEmpty().withMessage("Current password is required"),
        body("newPassword")
            .isString()
            .isLength({ min: 8 })
            .withMessage("New password must be at least 8 characters")
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/)
            .withMessage("Password must include uppercase, lowercase, number, and special character"),
        body("confirmPassword").isString().notEmpty().withMessage("Confirm password is required"),
    ]),
    changeMyPassword
);

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

const express = require("express");
const { body, validationResult } = require("express-validator");

const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

const validate = (checks) => async (req, res, next) => {
    await Promise.all(checks.map((c) => c.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

router.post(
    "/register",
    validate([
        body("name").isString().trim().notEmpty(),
        body("email").isEmail(),
        body("password").isLength({ min: 8 }),
        body("role").isString().notEmpty(),
    ]),
    authController.register
);

router.get("/activate", authController.activateAccount);
router.post(
    "/activate",
    validate([body("token").isString().notEmpty()]),
    authController.activateAccount
);

router.post(
    "/login",
    validate([body("email").isEmail(), body("password").isString().notEmpty()]),
    authController.login
);

router.post("/logout", authenticate, authController.logout);

router.get("/verify", authenticate, authController.verifyAuthToken);

module.exports = router;

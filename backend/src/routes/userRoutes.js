const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticate, (req, res) => {
    res.status(200).json({ message: "User routes placeholder" });
});

module.exports = router;

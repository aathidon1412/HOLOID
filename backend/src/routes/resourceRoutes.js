const express = require("express");
const { body, param, validationResult } = require("express-validator");

const {
    createInventory,
    updateInventory,
    updateBedStatus,
    getResources,
} = require("../controllers/resourceController");

const BED_TYPES = ["ICU", "General", "Ventilator", "Oxygen-supported"];
const BED_STATUSES = ["Occupied", "Vacant", "Maintenance", "Reserved", "Unavailable"];

const changeBedStatusValidation = [
    param("hospitalId")
        .exists({ checkFalsy: true })
        .withMessage("hospitalId is required")
        .bail()
        .isMongoId()
        .withMessage("hospitalId must be a valid MongoDB ObjectId"),
    body("bedType")
        .exists({ checkFalsy: true })
        .withMessage("bedType is required")
        .bail()
        .isIn(BED_TYPES)
        .withMessage("bedType must be one of: ICU, General, Ventilator, Oxygen-supported"),
    body("status")
        .exists({ checkFalsy: true })
        .withMessage("status is required")
        .bail()
        .isIn(BED_STATUSES)
        .withMessage("status must be one of: Occupied, Vacant, Maintenance, Reserved, Unavailable"),
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        return next();
    },
];

const createResourceRouter = (io) => {
    const router = express.Router();

    router.post("/", createInventory);
    router.put("/:hospitalId", updateInventory);
    router.put("/:hospitalId/beds", changeBedStatusValidation, updateBedStatus(io));
    router.get("/", getResources);

    return router;
};

module.exports = createResourceRouter;

const mongoose = require("mongoose");
const Resource = require("../models/Resource");

const BED_TYPES = ["ICU", "General", "Ventilator", "Oxygen-supported"];
const BED_STATUS = ["Occupied", "Vacant", "Maintenance"];

const createInventory = async (req, res) => {
    try {
        const { hospital, region, beds } = req.body;

        if (!hospital || !region) {
            return res.status(400).json({
                message: "hospital and region are required",
            });
        }

        const payload = { hospital, region };
        if (beds) {
            payload.beds = beds;
        }

        const resource = await Resource.create(payload);
        return res.status(201).json(resource);
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({ message: "Failed to create inventory" });
    }
};

const updateBedStatus = (io) => async (req, res) => {
    try {
        const { hospitalId } = req.params;
        const { bedType, status } = req.body;

        if (!hospitalId || !mongoose.Types.ObjectId.isValid(hospitalId)) {
            return res.status(400).json({ message: "Valid hospitalId is required" });
        }

        if (!BED_TYPES.includes(bedType)) {
            return res.status(400).json({
                message:
                    "Invalid bedType. Allowed values: ICU, General, Ventilator, Oxygen-supported",
            });
        }

        if (!BED_STATUS.includes(status)) {
            return res.status(400).json({
                message: "Invalid status. Allowed values: Occupied, Vacant, Maintenance",
            });
        }

        const updatePath = `beds.${bedType}.status`;

        const updatedResource = await Resource.findOneAndUpdate(
            { hospital: hospitalId },
            { $set: { [updatePath]: status } },
            { new: true, runValidators: true }
        );

        if (!updatedResource) {
            return res.status(400).json({
                message: "Resource inventory not found for the specified hospitalId",
            });
        }

        if (io && typeof updatedResource.region === "string" && updatedResource.region) {
            io.to(updatedResource.region).emit("bed-update", updatedResource);

            // Emit a fine-grained event for hospital and region subscribers
            const payload = {
                hospital: updatedResource.hospital,
                region: updatedResource.region,
                bedType,
                status,
                updatedAt: updatedResource.updatedAt || new Date(),
            };

            io.to(`hospital-${updatedResource.hospital}`).emit("bed-status-changed", payload);
            io.to(updatedResource.region).emit("bed-status-changed", payload);
        }

        return res.status(200).json(updatedResource);
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({ message: "Failed to update bed status" });
    }
};

const getResources = async (req, res) => {
    try {
        const { hospitalId, region } = req.query;
        const filter = {};

        if (hospitalId) {
            if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
                return res.status(400).json({
                    message: "hospitalId must be a valid ObjectId",
                });
            }

            filter.hospital = hospitalId;
        }

        if (region) {
            filter.region = region;
        }

        const resources = await Resource.find(filter).populate("hospital");
        return res.status(200).json(resources);
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch resources" });
    }
};

module.exports = {
    createInventory,
    updateBedStatus,
    getResources,
};

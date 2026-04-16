const mongoose = require("mongoose");
const Resource = require("../models/Resource");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

const BED_TYPES = ["ICU", "General", "Ventilator", "Oxygen-supported"];
const BED_STATUS = ["Occupied", "Vacant", "Maintenance", "Reserved", "Unavailable"];

const isValidHospitalId = (hospitalId) =>
    hospitalId && mongoose.Types.ObjectId.isValid(hospitalId);

const applyBedStatusUpdate = (resource, { wardName, bedType, status, count }) => {
    const deltas = [];

    for (const ward of resource.wards) {
        if (wardName && ward.wardName !== wardName) {
            continue;
        }

        for (const bed of ward.beds) {
            if (bed.type !== bedType) {
                continue;
            }

            const previousStatus = bed.status;
            const previousCount = bed.count;

            bed.status = status;
            if (count !== undefined) {
                bed.count = count;
            }

            deltas.push({
                wardName: ward.wardName,
                bedType,
                previousStatus,
                newStatus: bed.status,
                previousCount,
                newCount: bed.count,
                message: `${ward.wardName} ${bedType} bed became ${bed.status}`,
            });
        }
    }

    return deltas;
};

const createInventory = async (req, res) => {
    try {
        const { hospital, region, wards } = req.body;

        if (!isValidHospitalId(hospital) || !region) {
            return res.status(400).json({
                message: "Valid hospital and region are required",
            });
        }

        const existing = await Resource.findOne({ hospital });
        if (existing) {
            return res.status(409).json({
                message:
                    "Inventory already exists for this hospital. Use update inventory endpoint.",
            });
        }

        const payload = { hospital, region };
        if (Array.isArray(wards)) {
            payload.wards = wards;
        }

        const resource = await Resource.create(payload);
        return res.status(201).json(new ApiResponse(201, resource, "Inventory created successfully"));
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({ message: "Failed to create inventory" });
    }
};

const updateInventory = async (req, res) => {
    try {
        const { hospitalId } = req.params;
        const { region, wards } = req.body;

        if (!isValidHospitalId(hospitalId)) {
            return res.status(400).json({ message: "Valid hospitalId is required" });
        }

        if (region === undefined && wards === undefined) {
            return res.status(400).json({
                message: "At least one of region or wards is required",
            });
        }

        const updatePayload = {};
        if (region !== undefined) {
            updatePayload.region = region;
        }
        if (wards !== undefined) {
            if (!Array.isArray(wards)) {
                return res.status(400).json({ message: "wards must be an array" });
            }
            updatePayload.wards = wards;
        }

        const updatedInventory = await Resource.findOneAndUpdate(
            { hospital: hospitalId },
            { $set: updatePayload },
            { new: true, runValidators: true }
        );

        if (!updatedInventory) {
            return res.status(404).json({
                message: "Resource inventory not found for the specified hospitalId",
            });
        }

        return res.status(200).json(new ApiResponse(200, updatedInventory, "Inventory updated successfully"));
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: error.message });
        }

        return res.status(500).json({ message: "Failed to update inventory" });
    }
};

const updateBedStatus = (io) => async (req, res) => {
    try {
        const { hospitalId } = req.params;
        const { wardName, bedType, status, count } = req.body;

        if (!isValidHospitalId(hospitalId)) {
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
                message: "Invalid status. Allowed values: Occupied, Vacant, Maintenance, Reserved, Unavailable",
            });
        }

        if (count !== undefined && (!Number.isInteger(count) || count < 0)) {
            return res.status(400).json({
                message: "count must be a non-negative integer",
            });
        }

        const resource = await Resource.findOne({ hospital: hospitalId });
        if (!resource) {
            return res.status(400).json({
                message: "Resource inventory not found for the specified hospitalId",
            });
        }

        const deltas = applyBedStatusUpdate(resource, { wardName, bedType, status, count });

        if (!deltas.length) {
            return res.status(400).json({
                message:
                    "No matching ward/bed entry found. Provide a valid wardName and existing bed type in that ward.",
            });
        }

        const updatedResource = await resource.save();

        if (io && typeof updatedResource.region === "string" && updatedResource.region) {
            const bedUpdatePayload = {
                hospital: updatedResource.hospital,
                region: updatedResource.region,
                wards: updatedResource.wards,
                updatedAt: updatedResource.updatedAt || new Date(),
            };

            io.to(updatedResource.region).emit("bed-update", bedUpdatePayload);

            for (const delta of deltas) {
                const deltaPayload = {
                    hospital: updatedResource.hospital,
                    region: updatedResource.region,
                    wardName: delta.wardName,
                    bedType: delta.bedType,
                    previousStatus: delta.previousStatus,
                    status: delta.newStatus,
                    previousCount: delta.previousCount,
                    count: delta.newCount,
                    message: delta.message,
                    updatedAt: updatedResource.updatedAt || new Date(),
                };

                io.to(updatedResource.region).emit("bed-status-changed", deltaPayload);
            }
        }

        return res.status(200).json(new ApiResponse(200, updatedResource, "Bed status updated successfully"));
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
        return res.status(200).json(new ApiResponse(200, resources, "Resources fetched successfully"));
    } catch (error) {
        return res.status(500).json({ message: "Failed to fetch resources" });
    }
};

module.exports = {
    createInventory,
    updateInventory,
    updateBedStatus,
    getResources,
};

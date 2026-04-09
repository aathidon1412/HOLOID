const mongoose = require("mongoose");

const BED_TYPES = ["ICU", "General", "Ventilator", "Oxygen-supported"];
const BED_STATUS = ["Occupied", "Vacant", "Maintenance"];

const wardBedSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: BED_TYPES,
            required: true,
        },
        status: {
            type: String,
            enum: BED_STATUS,
            default: "Vacant",
            required: true,
        },
        count: {
            type: Number,
            min: 0,
            default: 0,
            required: true,
        },
    },
    { _id: false }
);

const wardSchema = new mongoose.Schema(
    {
        wardName: {
            type: String,
            required: true,
            trim: true,
        },
        beds: {
            type: [wardBedSchema],
            default: [],
            validate: {
                validator(value) {
                    if (!Array.isArray(value)) {
                        return false;
                    }

                    const seenTypeStatusPairs = new Set();
                    for (const bed of value) {
                        const pairKey = `${bed.type}:${bed.status}`;
                        if (seenTypeStatusPairs.has(pairKey)) {
                            return false;
                        }

                        seenTypeStatusPairs.add(pairKey);
                    }

                    return true;
                },
                message:
                    "Beds must use unique type/status pairs per ward with non-negative counts.",
            },
        },
    },
    { _id: false }
);

const resourceSchema = new mongoose.Schema(
    {
        hospital: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hospital",
            required: true,
            index: true,
        },
        region: {
            type: String,
            required: true,
            trim: true,
        },
        wards: {
            type: [wardSchema],
            default: [],
            required: true,
        },
    },
    { timestamps: true }
);

resourceSchema.index({ hospital: 1, "wards.beds.type": 1, "wards.beds.status": 1 });

resourceSchema.statics.getAvailableIcuBedsByHospital = async function (hospitalId) {
    const normalizedHospitalId =
        typeof hospitalId === "string" ? new mongoose.Types.ObjectId(hospitalId) : hospitalId;

    const result = await this.aggregate([
        { $match: { hospital: normalizedHospitalId } },
        { $unwind: "$wards" },
        { $unwind: "$wards.beds" },
        {
            $match: {
                "wards.beds.type": "ICU",
                "wards.beds.status": "Vacant",
            },
        },
        {
            $group: {
                _id: "$hospital",
                totalAvailableIcuBeds: { $sum: "$wards.beds.count" },
            },
        },
    ]);

    return result[0] ? result[0].totalAvailableIcuBeds : 0;
};

module.exports = mongoose.models.Resource || mongoose.model("Resource", resourceSchema);

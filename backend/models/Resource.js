const mongoose = require("mongoose");

const BED_STATUS = ["Occupied", "Vacant", "Maintenance"];

const singleBedSchema = new mongoose.Schema(
	{
		status: {
			type: String,
			enum: BED_STATUS,
			default: "Vacant",
			required: true,
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
		beds: {
			ICU: { type: singleBedSchema, default: () => ({ status: "Vacant" }) },
			General: { type: singleBedSchema, default: () => ({ status: "Vacant" }) },
			Ventilator: { type: singleBedSchema, default: () => ({ status: "Vacant" }) },
			"Oxygen-supported": {
				type: singleBedSchema,
				default: () => ({ status: "Vacant" }),
			},
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.models.Resource || mongoose.model("Resource", resourceSchema);

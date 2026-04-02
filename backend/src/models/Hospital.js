const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		registrationNumber: {
			type: String,
			trim: true,
			unique: true,
			sparse: true,
		},
		location: {
			addressLine1: { type: String, trim: true, required: true },
			city: { type: String, trim: true, required: true },
			state: { type: String, trim: true, required: true },
			country: { type: String, trim: true, required: true },
			postalCode: { type: String, trim: true },
			coordinates: {
				type: {
					type: String,
					enum: ["Point"],
					default: "Point",
				},
				coordinates: {
					type: [Number],
					default: [0, 0],
				},
			},
		},
		contact: {
			phone: { type: String, trim: true, required: true },
			email: { type: String, trim: true, lowercase: true, required: true },
			emergencyPhone: { type: String, trim: true },
		},
		capacity: {
			totalBeds: { type: Number, required: true, min: 0 },
			icuBeds: { type: Number, default: 0, min: 0 },
			availableBeds: { type: Number, required: true, min: 0 },
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

hospitalSchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model("Hospital", hospitalSchema);

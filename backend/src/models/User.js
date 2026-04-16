const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = require("../utils/roles");

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
		},
		password: {
			type: String,
			required: true,
			minlength: 8,
			select: false,
		},
		role: {
			type: String,
			enum: Object.values(ROLES),
			required: true,
		},
		hospital: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Hospital",
			default: null,
		},
		isActive: {
			type: Boolean,
			default: false,
		},
		lastLoginAt: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: true,
	}
);

userSchema.add({
	// Whether this user has been approved by the required authority
	isApproved: { type: Boolean, default: false },
	approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
	approvedAt: { type: Date, default: null },
	rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
	rejectedAt: { type: Date, default: null },
	rejectionReason: { type: String, default: "" },
});

userSchema.pre("save", async function preSave() {
	if (!this.isModified("password")) {
		return;
	}

	this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(plainPassword) {
	return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

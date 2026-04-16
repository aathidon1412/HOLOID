const mongoose = require("mongoose");

const ambulanceSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true
    },
    label: {
      type: String,
      default: "",
      trim: true
    },
    currentDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ["available", "assigned", "in_service", "offline"],
      default: "available",
      index: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    capabilities: {
      hasVentilator: { type: Boolean, default: false },
      hasAdvancedLifeSupport: { type: Boolean, default: false }
    },
    lastKnownLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

ambulanceSchema.index({ hospital: 1, status: 1, active: 1 });

module.exports = mongoose.model("Ambulance", ambulanceSchema);

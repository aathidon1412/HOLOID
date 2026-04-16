const mongoose = require("mongoose");

const bedSlotSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true
    },
    region: {
      type: String,
      trim: true,
      default: ""
    },
    wardName: {
      type: String,
      trim: true,
      required: true
    },
    bedType: {
      type: String,
      enum: ["ICU", "General", "Ventilator", "Oxygen-supported"],
      required: true,
      index: true
    },
    slotLabel: {
      type: String,
      trim: true,
      required: true
    },
    status: {
      type: String,
      enum: ["Occupied", "Vacant", "Maintenance", "Reserved", "Unavailable"],
      default: "Vacant",
      index: true
    },
    reservedAt: {
      type: Date,
      default: null
    },
    occupiedAt: {
      type: Date,
      default: null
    },
    releasedAt: {
      type: Date,
      default: null
    },
    reservedForTransfer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transfer",
      default: null,
      index: true
    },
    reservedForPatient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
      index: true
    }
  },
  { timestamps: true }
);

bedSlotSchema.index({ hospital: 1, bedType: 1, status: 1 });

module.exports = mongoose.model("BedSlot", bedSlotSchema);

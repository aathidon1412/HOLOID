const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
      default: ""
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      min: 0,
      default: null
    },
    sex: {
      type: String,
      enum: ["male", "female", "other", "unknown"],
      default: "unknown"
    },
    requiredBedType: {
      type: String,
      enum: ["generalBeds", "icuBeds", "ventilatorBeds"],
      required: true
    },
    currentHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null
    },
    status: {
      type: String,
      enum: ["awaiting_transfer", "in_transit", "admitted", "discharged", "cancelled"],
      default: "awaiting_transfer"
    },
    transferHistory: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Transfer",
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);

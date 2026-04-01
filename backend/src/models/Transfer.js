const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["requested", "dispatched", "in_transit", "completed", "cancelled"],
      required: true
    },
    note: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const actorSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    id: { type: String, default: "" },
    name: { type: String, default: "" }
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    distanceKm: { type: Number, default: 0 },
    durationMin: { type: Number, default: 0 },
    source: { type: String, default: "haversine" }
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    patientId: { type: String, default: "", trim: true },
    requiredBedType: {
      type: String,
      enum: ["generalBeds", "icuBeds", "ventilatorBeds"],
      required: true
    },
    fromHospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    toHospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    requestedBy: { type: actorSchema, required: true },
    status: {
      type: String,
      enum: ["requested", "dispatched", "in_transit", "completed", "cancelled"],
      default: "requested",
      index: true
    },
    route: { type: routeSchema, default: () => ({}) },
    timeline: { type: [timelineSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transfer", transferSchema);

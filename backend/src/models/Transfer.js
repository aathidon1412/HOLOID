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

const destinationBedSnapshotSchema = new mongoose.Schema(
  {
    bedType: { type: String, default: "" },
    wardName: { type: String, default: "" },
    slotLabel: { type: String, default: "" },
    reservedAt: { type: Date, default: null },
    occupiedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null }
  },
  { _id: false }
);

const driverTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["idle", "en_route", "arrived", "in_transit", "handover_complete"],
      required: true
    },
    note: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const dispatchMetaSchema = new mongoose.Schema(
  {
    assignedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    lastStatusAt: { type: Date, default: null }
  },
  { _id: false }
);

const driverLiveSchema = new mongoose.Schema(
  {
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
      source: { type: String, default: "driver" }
    },
    cadenceSec: { type: Number, default: 30 },
    isMoving: { type: Boolean, default: false },
    speedKmph: { type: Number, default: null },
    etaToDestinationMin: { type: Number, default: null },
    distanceToDestinationKm: { type: Number, default: null }
  },
  { _id: false }
);

const driverLocationPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    isMoving: { type: Boolean, default: false },
    cadenceSec: { type: Number, default: 30 },
    speedKmph: { type: Number, default: null },
    recordedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    patientId: { type: String, default: "", trim: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", default: null },
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
    reservedBedSlot: { type: mongoose.Schema.Types.ObjectId, ref: "BedSlot", default: null },
    assignedAmbulance: { type: mongoose.Schema.Types.ObjectId, ref: "Ambulance", default: null },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    dispatchStatus: {
      type: String,
      enum: ["unassigned", "pending_driver", "accepted", "rejected"],
      default: "unassigned",
      index: true
    },
    driverWorkflowStatus: {
      type: String,
      enum: ["idle", "en_route", "arrived", "in_transit", "handover_complete"],
      default: "idle",
      index: true
    },
    dispatchMeta: { type: dispatchMetaSchema, default: () => ({}) },
    driverTimeline: { type: [driverTimelineSchema], default: [] },
    driverLive: { type: driverLiveSchema, default: () => ({}) },
    driverLocationTimeline: { type: [driverLocationPointSchema], default: [] },
    reservationStatus: {
      type: String,
      enum: ["none", "reserved", "occupied", "released"],
      default: "none"
    },
    sourceBedReleasedAt: {
      type: Date,
      default: null
    },
    destinationBedSnapshot: { type: destinationBedSnapshotSchema, default: () => ({}) },
    route: { type: routeSchema, default: () => ({}) },
    timeline: { type: [timelineSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transfer", transferSchema);

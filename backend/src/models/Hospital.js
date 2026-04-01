const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    generalBeds: { type: Number, default: 0, min: 0 },
    icuBeds: { type: Number, default: 0, min: 0 },
    ventilatorBeds: { type: Number, default: 0, min: 0 },
    totalGeneralBeds: { type: Number, default: 0, min: 0 },
    totalIcuBeds: { type: Number, default: 0, min: 0 },
    totalVentilatorBeds: { type: Number, default: 0, min: 0 },
    ambulancesAvailable: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  { _id: false }
);

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true, index: true },
    location: { type: locationSchema, required: true },
    resources: { type: resourceSchema, default: () => ({}) },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

hospitalSchema.index({ "location.lat": 1, "location.lng": 1 });

module.exports = mongoose.model("Hospital", hospitalSchema);

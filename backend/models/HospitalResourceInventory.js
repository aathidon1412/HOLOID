const mongoose = require("mongoose");

const BED_TYPES = ["ICU", "General", "Ventilator", "Oxygen-supported"];
const BED_STATUSES = ["Occupied", "Vacant", "Maintenance"];

const bedStatusSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: BED_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: BED_STATUSES,
      required: true,
      default: "Vacant",
    },
  },
  { _id: false }
);

const hospitalResourceInventorySchema = new mongoose.Schema(
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
      type: [bedStatusSchema],
      required: true,
      validate: {
        validator: function (value) {
          if (!Array.isArray(value) || value.length !== BED_TYPES.length) {
            return false;
          }

          const seenTypes = value.map((entry) => entry.type);
          return BED_TYPES.every((type) => seenTypes.includes(type));
        },
        message:
          "Beds must include exactly one entry for each type: ICU, General, Ventilator, Oxygen-supported.",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "HospitalResourceInventory",
  hospitalResourceInventorySchema
);

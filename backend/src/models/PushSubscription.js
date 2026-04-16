const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: {
      type: String,
      default: "",
      trim: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    lastSuccessAt: {
      type: Date,
      default: null
    },
    lastFailureAt: {
      type: Date,
      default: null
    },
    failureReason: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1, active: 1 });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);

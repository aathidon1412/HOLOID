const mongoose = require("mongoose");

const actorSchema = new mongoose.Schema(
  {
    role: { type: String, default: "system" },
    id: { type: String, default: "" },
    name: { type: String, default: "" }
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    actor: { type: actorSchema, default: () => ({ role: "system" }) },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);

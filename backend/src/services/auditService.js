const AuditLog = require("../models/AuditLog");

const createAuditLog = async ({ entityType, entityId, action, actor, metadata }) => {
  return AuditLog.create({
    entityType,
    entityId: String(entityId),
    action,
    actor: actor || { role: "system" },
    metadata: metadata || {}
  });
};

module.exports = {
  createAuditLog
};

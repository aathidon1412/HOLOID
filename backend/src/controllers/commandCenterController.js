const Hospital = require("../models/Hospital");
const Transfer = require("../models/Transfer");
const AuditLog = require("../models/AuditLog");

const getRegionOccupancySummary = async (req, res) => {
  const hospitals = await Hospital.find({ active: true }).lean();

  const summaryMap = new Map();

  for (const hospital of hospitals) {
    const region = hospital.region || "UNKNOWN";

    if (!summaryMap.has(region)) {
      summaryMap.set(region, {
        region,
        hospitals: 0,
        totalCapacity: {
          generalBeds: 0,
          icuBeds: 0,
          ventilatorBeds: 0
        },
        available: {
          generalBeds: 0,
          icuBeds: 0,
          ventilatorBeds: 0
        }
      });
    }

    const row = summaryMap.get(region);
    row.hospitals += 1;

    const availableGeneral = hospital.resources?.generalBeds || 0;
    const availableIcu = hospital.resources?.icuBeds || 0;
    const availableVentilator = hospital.resources?.ventilatorBeds || 0;

    row.available.generalBeds += availableGeneral;
    row.available.icuBeds += availableIcu;
    row.available.ventilatorBeds += availableVentilator;

    const totalGeneral = hospital.resources?.totalGeneralBeds || availableGeneral;
    const totalIcu = hospital.resources?.totalIcuBeds || availableIcu;
    const totalVentilator = hospital.resources?.totalVentilatorBeds || availableVentilator;

    row.totalCapacity.generalBeds += totalGeneral;
    row.totalCapacity.icuBeds += totalIcu;
    row.totalCapacity.ventilatorBeds += totalVentilator;
  }

  const regions = Array.from(summaryMap.values()).map((item) => {
    const rates = {
      generalBeds: item.totalCapacity.generalBeds
        ? Number((1 - item.available.generalBeds / item.totalCapacity.generalBeds).toFixed(2))
        : 0,
      icuBeds: item.totalCapacity.icuBeds
        ? Number((1 - item.available.icuBeds / item.totalCapacity.icuBeds).toFixed(2))
        : 0,
      ventilatorBeds: item.totalCapacity.ventilatorBeds
        ? Number((1 - item.available.ventilatorBeds / item.totalCapacity.ventilatorBeds).toFixed(2))
        : 0
    };

    return {
      ...item,
      occupancyRate: rates
    };
  });

  return res.status(200).json({ count: regions.length, regions });
};

const listCriticalHospitals = async (req, res) => {
  const threshold = Number(req.query.threshold || process.env.CRITICAL_BED_THRESHOLD || 2);

  const hospitals = await Hospital.find({ active: true }).lean();

  const criticalHospitals = hospitals
    .map((hospital) => {
      const criticalTypes = [];
      if ((hospital.resources?.generalBeds || 0) <= threshold) criticalTypes.push("generalBeds");
      if ((hospital.resources?.icuBeds || 0) <= threshold) criticalTypes.push("icuBeds");
      if ((hospital.resources?.ventilatorBeds || 0) <= threshold) criticalTypes.push("ventilatorBeds");

      return {
        ...hospital,
        criticalTypes
      };
    })
    .filter((hospital) => hospital.criticalTypes.length > 0);

  return res.status(200).json({
    threshold,
    count: criticalHospitals.length,
    hospitals: criticalHospitals
  });
};

const listTransferHistory = async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const status = req.query.status;
  const query = status ? { status } : {};

  const transfers = await Transfer.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region")
    .lean();

  return res.status(200).json({ count: transfers.length, transfers });
};

const listAuditLogs = async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const entityType = req.query.entityType;
  const action = req.query.action;

  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (action) filter.action = action;

  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

  return res.status(200).json({ count: logs.length, logs });
};

module.exports = {
  getRegionOccupancySummary,
  listCriticalHospitals,
  listTransferHistory,
  listAuditLogs
};

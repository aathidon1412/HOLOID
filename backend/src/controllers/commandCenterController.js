const Hospital = require("../models/Hospital");
const Transfer = require("../models/Transfer");
const AuditLog = require("../models/AuditLog");

const getRegionFromHospital = (hospital) =>
  hospital.region || hospital.location?.state || hospital.location?.city || "UNKNOWN";

const getAvailableBeds = (hospital, type) => {
  if (typeof hospital.resources?.[type] === "number") {
    return hospital.resources[type];
  }

  if (type === "generalBeds") return hospital.capacity?.availableBeds || 0;
  if (type === "icuBeds") return hospital.capacity?.icuBeds || 0;
  return 0;
};

const getHospitalCoordinates = (hospital) => {
  if (!hospital?.location) return null;

  if (typeof hospital.location.lat === "number" && typeof hospital.location.lng === "number") {
    return { lat: hospital.location.lat, lng: hospital.location.lng };
  }

  const point = hospital.location.coordinates?.coordinates;
  if (Array.isArray(point) && point.length === 2) {
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
};

const getTotalBeds = (hospital, type, available) => {
  if (type === "generalBeds") {
    return hospital.resources?.totalGeneralBeds || hospital.capacity?.totalBeds || available;
  }

  if (type === "icuBeds") {
    return hospital.resources?.totalIcuBeds || hospital.capacity?.icuBeds || available;
  }

  return hospital.resources?.totalVentilatorBeds || available;
};

const getRegionOccupancySummary = async (req, res) => {
  const hospitals = await Hospital.find({ active: true }).lean();

  const summaryMap = new Map();

  for (const hospital of hospitals) {
    const region = getRegionFromHospital(hospital);

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

    const availableGeneral = getAvailableBeds(hospital, "generalBeds");
    const availableIcu = getAvailableBeds(hospital, "icuBeds");
    const availableVentilator = getAvailableBeds(hospital, "ventilatorBeds");

    row.available.generalBeds += availableGeneral;
    row.available.icuBeds += availableIcu;
    row.available.ventilatorBeds += availableVentilator;

    const totalGeneral = getTotalBeds(hospital, "generalBeds", availableGeneral);
    const totalIcu = getTotalBeds(hospital, "icuBeds", availableIcu);
    const totalVentilator = getTotalBeds(hospital, "ventilatorBeds", availableVentilator);

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

const listLiveFleet = async (req, res) => {
  const activeTransfers = await Transfer.find({
    status: { $in: ["requested", "dispatched", "in_transit"] },
    assignedAmbulance: { $ne: null }
  })
    .sort({ updatedAt: -1 })
    .populate("fromHospital", "name region location")
    .populate("toHospital", "name region location")
    .populate("assignedAmbulance", "vehicleNumber label status")
    .populate("assignedDriver", "name email")
    .lean();

  const fleet = activeTransfers.map((transfer) => {
    const liveLocation = transfer.driverLive?.currentLocation;
    const destinationCoordinates = getHospitalCoordinates(transfer.toHospital);
    const originCoordinates = getHospitalCoordinates(transfer.fromHospital);

    const marker =
      liveLocation && typeof liveLocation.lat === "number" && typeof liveLocation.lng === "number"
        ? {
            lat: liveLocation.lat,
            lng: liveLocation.lng,
            source: "driver",
            updatedAt: liveLocation.updatedAt || null
          }
        : destinationCoordinates
        ? {
            lat: destinationCoordinates.lat,
            lng: destinationCoordinates.lng,
            source: "destination",
            updatedAt: null
          }
        : null;

    return {
      transferId: String(transfer._id),
      patientName: transfer.patientName,
      requiredBedType: transfer.requiredBedType,
      transferStatus: transfer.status,
      dispatchStatus: transfer.dispatchStatus,
      driverWorkflowStatus: transfer.driverWorkflowStatus,
      fromHospital: {
        id: transfer.fromHospital?._id ? String(transfer.fromHospital._id) : "",
        name: transfer.fromHospital?.name || "",
        region: transfer.fromHospital?.region || "",
        coordinates: originCoordinates
      },
      toHospital: {
        id: transfer.toHospital?._id ? String(transfer.toHospital._id) : "",
        name: transfer.toHospital?.name || "",
        region: transfer.toHospital?.region || "",
        coordinates: destinationCoordinates
      },
      ambulance: {
        id: transfer.assignedAmbulance?._id ? String(transfer.assignedAmbulance._id) : "",
        vehicleNumber: transfer.assignedAmbulance?.vehicleNumber || "",
        label: transfer.assignedAmbulance?.label || "",
        status: transfer.assignedAmbulance?.status || ""
      },
      driver: {
        id: transfer.assignedDriver?._id ? String(transfer.assignedDriver._id) : "",
        name: transfer.assignedDriver?.name || ""
      },
      marker,
      cadenceSec: transfer.driverLive?.cadenceSec || null,
      isMoving: !!transfer.driverLive?.isMoving,
      speedKmph: transfer.driverLive?.speedKmph ?? null,
      etaToDestinationMin: transfer.driverLive?.etaToDestinationMin ?? transfer.route?.durationMin ?? null,
      distanceToDestinationKm: transfer.driverLive?.distanceToDestinationKm ?? transfer.route?.distanceKm ?? null,
      updatedAt: transfer.updatedAt
    };
  });

  const inTransit = fleet.filter((item) => item.transferStatus === "in_transit").length;
  const awaitingDriver = fleet.filter((item) => item.dispatchStatus === "pending_driver").length;
  const accepted = fleet.filter((item) => item.dispatchStatus === "accepted").length;

  return res.status(200).json({
    count: fleet.length,
    fleet,
    metrics: {
      activeTransfers: fleet.length,
      inTransit,
      awaitingDriver,
      accepted
    }
  });
};

module.exports = {
  getRegionOccupancySummary,
  listCriticalHospitals,
  listTransferHistory,
  listAuditLogs,
  listLiveFleet
};

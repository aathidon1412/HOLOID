const Hospital = require("../models/Hospital");
const Transfer = require("../models/Transfer");
const { normalizeBedType, ALLOWED_BED_TYPES } = require("../utils/bedType");
const { haversineDistanceKm, getRouteMetadata } = require("../services/mapService");
const { createAuditLog } = require("../services/auditService");
const { sendCriticalAlertEmail, sendTransferEventEmail } = require("../services/emailService");

const getRequester = (body = {}) => ({
  role: body.role || "doctor",
  id: body.id || "",
  name: body.name || ""
});

const parseCoordinates = (lat, lng) => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
};

const getHospitalCoordinates = (hospital) => {
  if (!hospital || !hospital.location) return null;

  if (typeof hospital.location.lat === "number" && typeof hospital.location.lng === "number") {
    return { lat: hospital.location.lat, lng: hospital.location.lng };
  }

  const coords = hospital.location.coordinates?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
};

const searchHospitalsByResource = async (req, res) => {
  const bedType = normalizeBedType(req.query.bedType);
  const minBeds = Number(req.query.minBeds || 1);
  const region = req.query.region;
  const sourceLocation = parseCoordinates(req.query.lat, req.query.lng);

  if (!ALLOWED_BED_TYPES.includes(bedType)) {
    return res.status(400).json({ message: "Invalid bedType" });
  }

  const filter = {
    active: true,
    [`resources.${bedType}`]: { $gte: minBeds }
  };

  if (region) filter.region = region;

  const hospitals = await Hospital.find(filter).lean();

  const response = hospitals.map((hospital) => {
    const payload = {
      ...hospital,
      availableBeds: hospital.resources?.[bedType] || 0
    };

    const targetCoordinates = getHospitalCoordinates(hospital);

    if (sourceLocation && targetCoordinates) {
      payload.distanceKm = Number(
        haversineDistanceKm(sourceLocation, targetCoordinates).toFixed(2)
      );
    }

    return payload;
  });

  if (sourceLocation) {
    response.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return res.status(200).json({
    count: response.length,
    hospitals: response
  });
};

const getNearestHospitalWithRequiredBed = async (req, res) => {
  const bedType = normalizeBedType(req.query.bedType);
  const minBeds = Number(req.query.minBeds || 1);
  const origin = parseCoordinates(req.query.lat, req.query.lng);
  const region = req.query.region;

  if (!origin) {
    return res.status(400).json({ message: "lat and lng are required" });
  }

  if (!ALLOWED_BED_TYPES.includes(bedType)) {
    return res.status(400).json({ message: "Invalid bedType" });
  }

  const filter = {
    active: true,
    [`resources.${bedType}`]: { $gte: minBeds }
  };

  if (region) filter.region = region;

  const hospitals = await Hospital.find(filter).lean();

  if (!hospitals.length) {
    return res.status(404).json({ message: "No hospital found with requested bed type" });
  }

  const sorted = hospitals
    .map((hospital) => {
      const targetCoordinates = getHospitalCoordinates(hospital);
      if (!targetCoordinates) return null;

      return {
        ...hospital,
        distanceKm: Number(haversineDistanceKm(origin, targetCoordinates).toFixed(2))
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!sorted.length) {
    return res.status(404).json({ message: "No hospital with mappable coordinates found" });
  }

  return res.status(200).json({ hospital: sorted[0] });
};

const requestPatientTransfer = async (req, res) => {
  const {
    patientName,
    patientId,
    requiredBedType,
    fromHospitalId,
    toHospitalId,
    requestedBy,
    notificationEmails
  } = req.body;

  if (!patientName || !requiredBedType || !fromHospitalId) {
    return res.status(400).json({
      message: "patientName, requiredBedType and fromHospitalId are required"
    });
  }

  const normalizedBedType = normalizeBedType(requiredBedType);
  if (!ALLOWED_BED_TYPES.includes(normalizedBedType)) {
    return res.status(400).json({ message: "Invalid requiredBedType" });
  }

  const fromHospital = await Hospital.findById(fromHospitalId);
  if (!fromHospital) {
    return res.status(404).json({ message: "fromHospital not found" });
  }

  let toHospital = null;

  if (toHospitalId) {
    toHospital = await Hospital.findById(toHospitalId);
    if (!toHospital) {
      return res.status(404).json({ message: "toHospital not found" });
    }

    if ((toHospital.resources?.[normalizedBedType] || 0) <= 0) {
      return res.status(400).json({ message: "toHospital does not have available beds" });
    }
  } else {
    const candidateFilter = {
      _id: { $ne: fromHospital._id },
      active: true,
      [`resources.${normalizedBedType}`]: { $gte: 1 }
    };

    if (fromHospital.region) {
      candidateFilter.region = fromHospital.region;
    }

    const candidates = await Hospital.find(candidateFilter).lean();

    if (!candidates.length) {
      return res.status(404).json({ message: "No destination hospital found" });
    }

    const fromHospitalCoordinates = getHospitalCoordinates(fromHospital);
    if (!fromHospitalCoordinates) {
      return res.status(400).json({ message: "fromHospital location coordinates are missing" });
    }

    const nearest = candidates
      .map((hospital) => {
        const targetCoordinates = getHospitalCoordinates(hospital);
        if (!targetCoordinates) return null;

        return {
          ...hospital,
          distanceKm: haversineDistanceKm(fromHospitalCoordinates, targetCoordinates)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    if (!nearest) {
      return res.status(404).json({ message: "No destination hospital with valid coordinates found" });
    }

    toHospital = await Hospital.findById(nearest._id);
  }

  const fromHospitalCoordinates = getHospitalCoordinates(fromHospital);
  const toHospitalCoordinates = getHospitalCoordinates(toHospital);

  if (!fromHospitalCoordinates || !toHospitalCoordinates) {
    return res.status(400).json({ message: "Both hospitals must have valid coordinates" });
  }

  const route = await getRouteMetadata(fromHospitalCoordinates, toHospitalCoordinates);

  const transfer = await Transfer.create({
    patientName,
    patientId: patientId || "",
    requiredBedType: normalizedBedType,
    fromHospital: fromHospital._id,
    toHospital: toHospital._id,
    requestedBy: getRequester(requestedBy),
    status: "requested",
    route,
    timeline: [{ status: "requested", note: "Transfer requested" }]
  });

  await createAuditLog({
    entityType: "transfer",
    entityId: transfer._id,
    action: "transfer_requested",
    actor: getRequester(requestedBy),
    metadata: {
      patientName,
      fromHospitalId,
      toHospitalId: String(toHospital._id),
      requiredBedType: normalizedBedType
    }
  });

  const threshold = Number(process.env.CRITICAL_BED_THRESHOLD || 2);
  const remainingBeds = toHospital.resources?.[normalizedBedType] || 0;

  if (remainingBeds <= threshold && Array.isArray(notificationEmails) && notificationEmails.length) {
    await sendCriticalAlertEmail({
      to: notificationEmails.join(","),
      hospitalName: toHospital.name,
      bedType: normalizedBedType,
      remainingBeds,
      region: toHospital.region || toHospital.location?.state || "UNKNOWN"
    });

    await sendTransferEventEmail({
      to: notificationEmails.join(","),
      transferId: String(transfer._id),
      status: "requested",
      patientName,
      fromHospitalName: fromHospital.name,
      toHospitalName: toHospital.name,
      note: "Transfer request created",
      route
    });
  }

  const response = await Transfer.findById(transfer._id)
    .populate("fromHospital", "name region location")
    .populate("toHospital", "name region location");

  return res.status(201).json({ transfer: response });
};

const trackTransfer = async (req, res) => {
  const transfer = await Transfer.findById(req.params.transferId)
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region");

  if (!transfer) {
    return res.status(404).json({ message: "Transfer not found" });
  }

  return res.status(200).json({ transfer });
};

const updateTransferStatus = async (req, res) => {
  const { status, note, actor } = req.body;

  if (!["requested", "dispatched", "in_transit", "completed", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const transfer = await Transfer.findById(req.params.transferId)
    .populate("fromHospital")
    .populate("toHospital");

  if (!transfer) {
    return res.status(404).json({ message: "Transfer not found" });
  }

  transfer.status = status;
  transfer.timeline.push({ status, note: note || "" });

  if (status === "completed") {
    const bedType = transfer.requiredBedType;

    if ((transfer.toHospital.resources?.[bedType] || 0) <= 0) {
      return res.status(400).json({ message: "Destination hospital bed unavailable" });
    }

    transfer.toHospital.resources[bedType] -= 1;
    transfer.fromHospital.resources[bedType] += 1;

    await transfer.toHospital.save();
    await transfer.fromHospital.save();

    await createAuditLog({
      entityType: "hospital",
      entityId: transfer.toHospital._id,
      action: "bed_occupied_after_transfer",
      actor: getRequester(actor),
      metadata: { bedType }
    });

    await createAuditLog({
      entityType: "hospital",
      entityId: transfer.fromHospital._id,
      action: "bed_released_after_transfer",
      actor: getRequester(actor),
      metadata: { bedType }
    });
  }

  await transfer.save();

  await createAuditLog({
    entityType: "transfer",
    entityId: transfer._id,
    action: "transfer_status_updated",
    actor: getRequester(actor),
    metadata: { status, note: note || "" }
  });

  const notificationEmails = req.body.notificationEmails;
  if (Array.isArray(notificationEmails) && notificationEmails.length) {
    await sendTransferEventEmail({
      to: notificationEmails.join(","),
      transferId: String(transfer._id),
      status,
      patientName: transfer.patientName,
      fromHospitalName: transfer.fromHospital.name,
      toHospitalName: transfer.toHospital.name,
      note: note || "",
      route: transfer.route
    });
  }

  return res.status(200).json({ transfer });
};

const updateHospitalResources = async (req, res) => {
  const { hospitalId } = req.params;
  const { resources, actor, notificationEmails } = req.body;

  if (!resources || typeof resources !== "object") {
    return res.status(400).json({ message: "resources object is required" });
  }

  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found" });
  }

  const allowedKeys = [
    "generalBeds",
    "icuBeds",
    "ventilatorBeds",
    "totalGeneralBeds",
    "totalIcuBeds",
    "totalVentilatorBeds",
    "ambulancesAvailable"
  ];

  const changed = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(resources, key)) {
      const value = Number(resources[key]);
      if (Number.isNaN(value) || value < 0) {
        return res.status(400).json({ message: `Invalid value for ${key}` });
      }
      hospital.resources[key] = value;
      changed[key] = value;
    }
  }

  await hospital.save();

  await createAuditLog({
    entityType: "hospital",
    entityId: hospital._id,
    action: "resources_updated",
    actor: getRequester(actor),
    metadata: { changed }
  });

  const threshold = Number(process.env.CRITICAL_BED_THRESHOLD || 2);
  const bedTypes = ["generalBeds", "icuBeds", "ventilatorBeds"];

  if (Array.isArray(notificationEmails) && notificationEmails.length) {
    for (const bedType of bedTypes) {
      const available = hospital.resources?.[bedType] || 0;
      if (available <= threshold) {
        await sendCriticalAlertEmail({
          to: notificationEmails.join(","),
          hospitalName: hospital.name,
          bedType,
          remainingBeds: available,
          region: hospital.region
        });
      }
    }
  }

  return res.status(200).json({ hospital });
};

module.exports = {
  searchHospitalsByResource,
  getNearestHospitalWithRequiredBed,
  requestPatientTransfer,
  trackTransfer,
  updateTransferStatus,
  updateHospitalResources
};

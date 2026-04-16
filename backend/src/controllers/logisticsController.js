const mongoose = require("mongoose");
const Hospital = require("../models/Hospital");
const Transfer = require("../models/Transfer");
const Patient = require("../models/Patient");
const { normalizeBedType, ALLOWED_BED_TYPES } = require("../utils/bedType");
const { haversineDistanceKm, getRouteMetadata } = require("../services/mapService");
const { createAuditLog } = require("../services/auditService");
const { sendCriticalAlertEmail, sendTransferEventEmail } = require("../services/emailService");
const {
  reserveBedSlot,
  occupyReservedBedSlot,
  releaseReservedBedSlot,
  releaseOneOccupiedSourceBedSlot,
  slotTypeFromBedType
} = require("../services/bedReservationService");

const TRANSITIONAL_STATUSES = ["requested", "dispatched", "in_transit", "completed", "cancelled"];

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

const sessionOpts = (session) => (session ? { session } : undefined);

const withSession = (query, session) => (session ? query.session(session) : query);

const saveWithSession = (doc, session) => (session ? doc.save({ session }) : doc.save());

const isTransactionUnsupportedError = (error) => {
  const message = String(error && error.message ? error.message : "").toLowerCase();
  return (
    message.includes("transaction numbers are only allowed") ||
    message.includes("replica set") ||
    message.includes("transactions are not supported")
  );
};

const runWithOptionalTransaction = async (operation) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_e) {
      // no-op
    }

    if (isTransactionUnsupportedError(error)) {
      return operation(null);
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

const normalizePatientSex = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["male", "female", "other"].includes(normalized)) {
    return normalized;
  }
  return "unknown";
};

const upsertPatient = async ({ patientName, patientId, requiredBedType, fromHospitalId, patientAge, patientSex, session }) => {
  let patient = null;

  if (patientId) {
    patient = await withSession(Patient.findOne({ patientId: String(patientId).trim() }), session);
  }

  if (!patient) {
    patient = new Patient({
      patientId: patientId ? String(patientId).trim() : "",
      name: patientName,
      age: Number.isFinite(Number(patientAge)) ? Number(patientAge) : null,
      sex: normalizePatientSex(patientSex),
      requiredBedType,
      currentHospital: fromHospitalId,
      status: "awaiting_transfer"
    });
  } else {
    patient.name = patientName;
    patient.requiredBedType = requiredBedType;
    patient.currentHospital = fromHospitalId;
    if (Number.isFinite(Number(patientAge))) {
      patient.age = Number(patientAge);
    }
    patient.sex = normalizePatientSex(patientSex);
    patient.status = "awaiting_transfer";
  }

  await saveWithSession(patient, session);
  return patient;
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
    patientAge,
    patientSex,
    requiredBedType,
    fromHospitalId,
    toHospitalId,
    targetHospitalId,
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

  let transferId = null;
  let fromHospitalName = "";
  let toHospitalName = "";
  let toHospitalRegion = "";
  let routeForNotification = null;
  let remainingBeds = 0;

  try {
    const creationResult = await runWithOptionalTransaction(async (session) => {
      const fromHospital = await withSession(Hospital.findById(fromHospitalId), session);
      if (!fromHospital) {
        throw new Error("fromHospital not found");
      }

      let toHospital = null;
      const destinationHospitalId = toHospitalId || targetHospitalId;

      if (destinationHospitalId) {
        toHospital = await withSession(Hospital.findById(destinationHospitalId), session);
        if (!toHospital) {
          throw new Error("toHospital not found");
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

        const candidates = await withSession(Hospital.find(candidateFilter).lean(), session);

        if (!candidates.length) {
          throw new Error("No destination hospital found");
        }

        const fromHospitalCoordinates = getHospitalCoordinates(fromHospital);
        if (!fromHospitalCoordinates) {
          throw new Error("fromHospital location coordinates are missing");
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
          throw new Error("No destination hospital with valid coordinates found");
        }

        toHospital = await withSession(Hospital.findById(nearest._id), session);
      }

      if ((toHospital.resources?.[normalizedBedType] || 0) <= 0) {
        throw new Error("toHospital does not have available beds");
      }

      const fromHospitalCoordinates = getHospitalCoordinates(fromHospital);
      const toHospitalCoordinates = getHospitalCoordinates(toHospital);

      if (!fromHospitalCoordinates || !toHospitalCoordinates) {
        throw new Error("Both hospitals must have valid coordinates");
      }

      const route = await getRouteMetadata(fromHospitalCoordinates, toHospitalCoordinates);

      const patient = await upsertPatient({
        patientName,
        patientId,
        requiredBedType: normalizedBedType,
        fromHospitalId: fromHospital._id,
        patientAge,
        patientSex,
        session
      });

      const transferDocs = await Transfer.create(
        [
          {
            patientName,
            patientId: patientId || "",
            patient: patient._id,
            requiredBedType: normalizedBedType,
            fromHospital: fromHospital._id,
            toHospital: toHospital._id,
            requestedBy: getRequester(requestedBy),
            status: "requested",
            reservationStatus: "none",
            route,
            timeline: [{ status: "requested", note: "Transfer requested" }]
          }
        ],
        sessionOpts(session)
      );

      const transfer = transferDocs[0];

      const reservedSlot = await reserveBedSlot({
        hospitalId: toHospital._id,
        normalizedBedType,
        transferId: transfer._id,
        patientId: patient._id,
        session
      });

      if (!reservedSlot) {
        throw new Error("No exact bed slot available to reserve");
      }

      toHospital.resources[normalizedBedType] = Math.max(
        0,
        Number(toHospital.resources?.[normalizedBedType] || 0) - 1
      );
      await saveWithSession(toHospital, session);

      transfer.reservedBedSlot = reservedSlot._id;
      transfer.reservationStatus = "reserved";
      transfer.destinationBedSnapshot = {
        bedType: slotTypeFromBedType(normalizedBedType) || "",
        wardName: reservedSlot.wardName,
        slotLabel: reservedSlot.slotLabel,
        reservedAt: reservedSlot.reservedAt,
        occupiedAt: null,
        releasedAt: null
      };
      await saveWithSession(transfer, session);

      patient.transferHistory.push(transfer._id);
      await saveWithSession(patient, session);

      return {
        transferId: transfer._id,
        route,
        fromHospitalName: fromHospital.name,
        toHospitalName: toHospital.name,
        toHospitalRegion: toHospital.region || toHospital.location?.state || "UNKNOWN",
        remainingBeds: toHospital.resources?.[normalizedBedType] || 0
      };
    });

    transferId = creationResult.transferId;
    routeForNotification = creationResult.route;
    fromHospitalName = creationResult.fromHospitalName;
    toHospitalName = creationResult.toHospitalName;
    toHospitalRegion = creationResult.toHospitalRegion;
    remainingBeds = creationResult.remainingBeds;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("fromHospital not found")) {
      return res.status(404).json({ message });
    }
    if (message.includes("toHospital not found")) {
      return res.status(404).json({ message });
    }
    if (
      message.includes("No destination hospital") ||
      message.includes("No exact bed slot available") ||
      message.includes("available beds")
    ) {
      return res.status(409).json({ message });
    }
    if (message.includes("coordinates")) {
      return res.status(400).json({ message });
    }

    throw error;
  }

  await createAuditLog({
    entityType: "transfer",
    entityId: transferId,
    action: "transfer_requested",
    actor: getRequester(requestedBy),
    metadata: {
      patientName,
      fromHospitalId,
      requiredBedType: normalizedBedType,
      reservationStatus: "reserved"
    }
  });

  const threshold = Number(process.env.CRITICAL_BED_THRESHOLD || 2);

  if (remainingBeds <= threshold && Array.isArray(notificationEmails) && notificationEmails.length) {
    await sendCriticalAlertEmail({
      to: notificationEmails.join(","),
      hospitalName: toHospitalName,
      bedType: normalizedBedType,
      remainingBeds,
      region: toHospitalRegion
    });

    await sendTransferEventEmail({
      to: notificationEmails.join(","),
      transferId: String(transferId),
      status: "requested",
      patientName,
      fromHospitalName,
      toHospitalName,
      note: "Transfer request created and bed reserved",
      route: routeForNotification
    });
  }

  const response = await Transfer.findById(transferId)
    .populate("fromHospital", "name region location")
    .populate("toHospital", "name region location")
    .populate("patient", "patientId name age sex status")
    .populate("reservedBedSlot", "wardName bedType slotLabel status reservedAt");

  return res.status(201).json({ transfer: response });
};

const trackTransfer = async (req, res) => {
  const transfer = await Transfer.findById(req.params.transferId)
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region")
    .populate("patient", "patientId name age sex status")
    .populate("reservedBedSlot", "wardName bedType slotLabel status reservedAt occupiedAt releasedAt");

  if (!transfer) {
    return res.status(404).json({ message: "Transfer not found" });
  }

  return res.status(200).json({ transfer });
};

const getTransferHistory = async (req, res) => {
  const { hospitalId, status } = req.query;
  const filter = {};

  if (hospitalId) {
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: "hospitalId must be a valid ObjectId" });
    }

    filter.$or = [{ fromHospital: hospitalId }, { toHospital: hospitalId }];
  }

  if (status) {
    filter.status = String(status).trim().toLowerCase();
  }

  const transfers = await Transfer.find(filter)
    .sort({ createdAt: -1 })
    .populate("fromHospital", "name")
    .populate("toHospital", "name")
    .lean();

  return res.status(200).json({ transfers });
};

const updateTransferStatus = async (req, res) => {
  const { status, note, actor } = req.body;

  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  const statusAlias = {
    accepted: "dispatched",
    rejected: "cancelled"
  };

  const finalStatus = statusAlias[normalizedStatus] || normalizedStatus;

  if (!TRANSITIONAL_STATUSES.includes(finalStatus)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  let transfer = null;
  let slotOccupied = false;
  let slotReleased = false;

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const transferDoc = await withSession(
        Transfer.findById(req.params.transferId)
          .populate("fromHospital")
          .populate("toHospital")
          .populate("patient")
          .populate("reservedBedSlot"),
        session
      );

      if (!transferDoc) {
        throw new Error("Transfer not found");
      }

      transferDoc.status = finalStatus;
      transferDoc.timeline.push({ status: finalStatus, note: note || "" });

      const bedType = transferDoc.requiredBedType;

      if (finalStatus === "dispatched" || finalStatus === "in_transit") {
        if (transferDoc.patient) {
          transferDoc.patient.status = "in_transit";
          await saveWithSession(transferDoc.patient, session);
        }
      }

      if (finalStatus === "completed") {
        if (transferDoc.reservationStatus !== "reserved" || !transferDoc.reservedBedSlot) {
          throw new Error("Transfer does not have an active bed reservation");
        }

        const occupiedSlot = await occupyReservedBedSlot({
          bedSlotId: transferDoc.reservedBedSlot._id,
          transferId: transferDoc._id,
          patientId: transferDoc.patient ? transferDoc.patient._id : null,
          session
        });

        if (!occupiedSlot) {
          throw new Error("Reserved bed slot is no longer available");
        }

        slotOccupied = true;

        transferDoc.reservationStatus = "occupied";
        transferDoc.destinationBedSnapshot = {
          ...transferDoc.destinationBedSnapshot,
          bedType: occupiedSlot.bedType,
          wardName: occupiedSlot.wardName,
          slotLabel: occupiedSlot.slotLabel,
          reservedAt: occupiedSlot.reservedAt,
          occupiedAt: occupiedSlot.occupiedAt,
          releasedAt: null
        };

        transferDoc.fromHospital.resources[bedType] =
          Number(transferDoc.fromHospital.resources?.[bedType] || 0) + 1;

        await saveWithSession(transferDoc.fromHospital, session);

        await releaseOneOccupiedSourceBedSlot({
          hospitalId: transferDoc.fromHospital._id,
          normalizedBedType: bedType,
          session
        });

        if (transferDoc.patient) {
          transferDoc.patient.currentHospital = transferDoc.toHospital._id;
          transferDoc.patient.status = "admitted";
          await saveWithSession(transferDoc.patient, session);
        }
      }

      if (finalStatus === "cancelled") {
        if (transferDoc.reservationStatus === "reserved" && transferDoc.reservedBedSlot) {
          const releasedSlot = await releaseReservedBedSlot({
            bedSlotId: transferDoc.reservedBedSlot._id,
            transferId: transferDoc._id,
            session
          });

          if (releasedSlot) {
            slotReleased = true;
            transferDoc.toHospital.resources[bedType] =
              Number(transferDoc.toHospital.resources?.[bedType] || 0) + 1;
            await saveWithSession(transferDoc.toHospital, session);

            transferDoc.reservationStatus = "released";
            transferDoc.destinationBedSnapshot = {
              ...transferDoc.destinationBedSnapshot,
              releasedAt: releasedSlot.releasedAt
            };
          }
        }

        if (transferDoc.patient) {
          transferDoc.patient.status = "cancelled";
          await saveWithSession(transferDoc.patient, session);
        }
      }

      await saveWithSession(transferDoc, session);
      return transferDoc;
    });

    transfer = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("Transfer not found")) {
      return res.status(404).json({ message });
    }

    if (message.includes("reservation") || message.includes("slot")) {
      return res.status(409).json({ message });
    }

    throw error;
  }

  if (slotOccupied) {
    await createAuditLog({
      entityType: "hospital",
      entityId: transfer.toHospital._id,
      action: "bed_occupied_after_transfer",
      actor: getRequester(actor),
      metadata: { bedType: transfer.requiredBedType, reservationStatus: "occupied" }
    });

    await createAuditLog({
      entityType: "hospital",
      entityId: transfer.fromHospital._id,
      action: "bed_released_after_transfer",
      actor: getRequester(actor),
      metadata: { bedType: transfer.requiredBedType, reservationStatus: "released_source" }
    });
  }

  if (slotReleased) {
    await createAuditLog({
      entityType: "hospital",
      entityId: transfer.toHospital._id,
      action: "reserved_bed_released",
      actor: getRequester(actor),
      metadata: { bedType: transfer.requiredBedType }
    });
  }

  await createAuditLog({
    entityType: "transfer",
    entityId: transfer._id,
    action: "transfer_status_updated",
    actor: getRequester(actor),
    metadata: { status: finalStatus, note: note || "" }
  });

  const notificationEmails = req.body.notificationEmails;
  if (Array.isArray(notificationEmails) && notificationEmails.length) {
    await sendTransferEventEmail({
      to: notificationEmails.join(","),
      transferId: String(transfer._id),
      status: finalStatus,
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
  getTransferHistory,
  trackTransfer,
  updateTransferStatus,
  updateHospitalResources
};

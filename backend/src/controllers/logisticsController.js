const mongoose = require("mongoose");
const Hospital = require("../models/Hospital");
const Transfer = require("../models/Transfer");
const Patient = require("../models/Patient");
const BedSlot = require("../models/BedSlot");
const User = require("../models/User");
const Ambulance = require("../models/Ambulance");
const { normalizeBedType, ALLOWED_BED_TYPES } = require("../utils/bedType");
const { haversineDistanceKm, getRouteMetadata } = require("../services/mapService");
const { createAuditLog } = require("../services/auditService");
const { sendCriticalAlertEmail, sendTransferEventEmail } = require("../services/emailService");
const ROLES = require("../utils/roles");
const {
  reserveBedSlot,
  occupyReservedBedSlot,
  releaseReservedBedSlot,
  releaseOneOccupiedSourceBedSlot,
  slotTypeFromBedType
} = require("../services/bedReservationService");

const TRANSITIONAL_STATUSES = ["requested", "dispatched", "in_transit", "completed", "cancelled"];
const SLOT_TYPES = ["ICU", "General", "Ventilator", "Oxygen-supported"];

const SLOT_TO_NORMALIZED = {
  ICU: "icuBeds",
  General: "generalBeds",
  Ventilator: "ventilatorBeds"
};

const BED_SLOT_SOCKET_EVENTS = {
  RESERVED: "bed-slot-reserved",
  OCCUPIED: "bed-slot-occupied",
  RELEASED: "bed-slot-released",
  STATUS_CHANGED: "bed-slot-status-changed"
};

const DISPATCH_SOCKET_EVENTS = {
  ASSIGNED: "dispatch-assigned",
  RESPONDED: "dispatch-responded",
  PROGRESS: "dispatch-progress-updated"
};

const DRIVER_PROGRESS_STATUS_MAP = {
  EN_ROUTE: "en_route",
  ARRIVED: "arrived",
  IN_TRANSIT: "in_transit",
  HANDOVER_COMPLETE: "handover_complete"
};

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

const normalizedBedTypeFromSlotType = (slotType) => SLOT_TO_NORMALIZED[slotType] || null;

const emitSocketEvent = (req, { eventName, hospitalId, region, payload }) => {
  const io = req?.app?.get && req.app.get("io");
  if (!io || !eventName) return;

  const normalizedHospitalId = hospitalId ? String(hospitalId) : "";
  const packet = {
    ...(payload || {}),
    hospitalId: normalizedHospitalId || payload?.hospitalId || "",
    region: region || payload?.region || null,
    emittedAt: new Date().toISOString()
  };

  if (normalizedHospitalId) {
    io.to(`hospital-${normalizedHospitalId}`).emit(eventName, packet);
  }

  if (packet.region) {
    io.to(packet.region).emit(eventName, packet);
  }
};

const emitBedSlotLifecycleEvent = (
  req,
  {
    eventName,
    hospitalId,
    region,
    slot,
    previousStatus = null,
    transferId = null,
    patientId = null,
    requiredBedType = null,
    reservationStatus = null,
    note = ""
  }
) => {
  const slotPayload = slot
    ? {
        id: String(slot._id || ""),
        wardName: slot.wardName || "",
        slotLabel: slot.slotLabel || "",
        bedType: slot.bedType || "",
        status: slot.status || "",
        reservedAt: slot.reservedAt || null,
        occupiedAt: slot.occupiedAt || null,
        releasedAt: slot.releasedAt || null
      }
    : null;

  const payload = {
    transferId: transferId ? String(transferId) : "",
    patientId: patientId ? String(patientId) : "",
    previousStatus,
    status: slot?.status || "",
    requiredBedType: requiredBedType || normalizedBedTypeFromSlotType(slot?.bedType),
    reservationStatus: reservationStatus || "",
    note: note || "",
    bedSlot: slotPayload
  };

  emitSocketEvent(req, { eventName, hospitalId, region, payload });
  if (eventName !== BED_SLOT_SOCKET_EVENTS.STATUS_CHANGED) {
    emitSocketEvent(req, {
      eventName: BED_SLOT_SOCKET_EVENTS.STATUS_CHANGED,
      hospitalId,
      region,
      payload: { ...payload, lifecycleEvent: eventName }
    });
  }
};

const emitDispatchEvent = (req, { eventName, hospitalId, region, driverId, payload }) => {
  emitSocketEvent(req, {
    eventName,
    hospitalId,
    region,
    payload
  });

  const io = req?.app?.get && req.app.get("io");
  if (io && driverId) {
    io.to(`user-${String(driverId)}`).emit(eventName, {
      ...(payload || {}),
      hospitalId: hospitalId ? String(hospitalId) : "",
      region: region || null,
      emittedAt: new Date().toISOString()
    });
  }
};

const syncHospitalAmbulanceAvailability = async ({ hospitalId, session }) => {
  if (!hospitalId) return;

  const availableCount = await withSession(
    Ambulance.countDocuments({
      hospital: hospitalId,
      active: true,
      status: "available"
    }),
    session
  );

  const hospital = await withSession(Hospital.findById(hospitalId), session);
  if (!hospital) return;

  hospital.resources.ambulancesAvailable = Number(availableCount || 0);
  await saveWithSession(hospital, session);
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
  let reservedSlotSnapshot = null;
  let autoDispatchSnapshot = null;

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

      const candidateAmbulance = await withSession(
        Ambulance.findOne({
          hospital: toHospital._id,
          active: true,
          status: "available",
          currentDriver: { $ne: null }
        }).sort({ updatedAt: 1 }),
        session
      );

      let assignedDriver = null;
      if (candidateAmbulance?.currentDriver) {
        assignedDriver = await withSession(User.findById(candidateAmbulance.currentDriver), session);
      }

      if (
        candidateAmbulance &&
        assignedDriver &&
        assignedDriver.isActive &&
        assignedDriver.role === ROLES.AMBULANCE_DRIVER &&
        assignedDriver.hospital &&
        String(assignedDriver.hospital) === String(toHospital._id)
      ) {
        transfer.assignedAmbulance = candidateAmbulance._id;
        transfer.assignedDriver = assignedDriver._id;
        transfer.dispatchStatus = "pending_driver";
        transfer.driverWorkflowStatus = "idle";
        transfer.dispatchMeta.assignedAt = new Date();
        transfer.dispatchMeta.lastStatusAt = new Date();
        transfer.driverTimeline.push({
          status: "idle",
          note: "Dispatch assigned to ambulance driver"
        });

        candidateAmbulance.status = "assigned";
        await saveWithSession(candidateAmbulance, session);
        await syncHospitalAmbulanceAvailability({ hospitalId: toHospital._id, session });

        await saveWithSession(transfer, session);

        autoDispatchSnapshot = {
          ambulanceId: candidateAmbulance._id,
          vehicleNumber: candidateAmbulance.vehicleNumber,
          driverId: assignedDriver._id,
          driverName: assignedDriver.name
        };
      }

      return {
        transferId: transfer._id,
        route,
        fromHospitalName: fromHospital.name,
        toHospitalName: toHospital.name,
        toHospitalRegion: toHospital.region || toHospital.location?.state || "UNKNOWN",
        remainingBeds: toHospital.resources?.[normalizedBedType] || 0,
        reservedSlotSnapshot: {
          _id: reservedSlot._id,
          wardName: reservedSlot.wardName,
          slotLabel: reservedSlot.slotLabel,
          bedType: reservedSlot.bedType,
          status: reservedSlot.status,
          reservedAt: reservedSlot.reservedAt,
          occupiedAt: reservedSlot.occupiedAt,
          releasedAt: reservedSlot.releasedAt
        },
        autoDispatchSnapshot
      };
    });

    transferId = creationResult.transferId;
    routeForNotification = creationResult.route;
    fromHospitalName = creationResult.fromHospitalName;
    toHospitalName = creationResult.toHospitalName;
    toHospitalRegion = creationResult.toHospitalRegion;
    remainingBeds = creationResult.remainingBeds;
    reservedSlotSnapshot = creationResult.reservedSlotSnapshot;
    autoDispatchSnapshot = creationResult.autoDispatchSnapshot;
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

  emitBedSlotLifecycleEvent(req, {
    eventName: BED_SLOT_SOCKET_EVENTS.RESERVED,
    hospitalId: response?.toHospital?._id,
    region: response?.toHospital?.region || toHospitalRegion,
    slot: response?.reservedBedSlot || reservedSlotSnapshot,
    previousStatus: "Vacant",
    transferId,
    patientId: response?.patient?._id,
    requiredBedType: normalizedBedType,
    reservationStatus: "reserved",
    note: "Bed reserved for incoming transfer"
  });

  if (autoDispatchSnapshot?.driverId) {
    emitDispatchEvent(req, {
      eventName: DISPATCH_SOCKET_EVENTS.ASSIGNED,
      hospitalId: response?.toHospital?._id,
      region: response?.toHospital?.region || toHospitalRegion,
      driverId: autoDispatchSnapshot.driverId,
      payload: {
        transferId: String(response?._id || transferId),
        patientName: response?.patientName,
        fromHospital: response?.fromHospital,
        toHospital: response?.toHospital,
        requiredBedType: response?.requiredBedType,
        dispatchStatus: "pending_driver",
        assignedAmbulance: {
          id: String(autoDispatchSnapshot.ambulanceId),
          vehicleNumber: autoDispatchSnapshot.vehicleNumber
        },
        assignedDriver: {
          id: String(autoDispatchSnapshot.driverId),
          name: autoDispatchSnapshot.driverName
        }
      }
    });
  }

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

const listOpenTransfersForHospital = async (req, res) => {
  const { hospitalId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
    return res.status(400).json({ message: "hospitalId must be a valid ObjectId" });
  }

  const transfers = await Transfer.find({
    toHospital: hospitalId,
    status: { $in: ["requested", "dispatched", "in_transit"] }
  })
    .sort({ createdAt: -1 })
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region")
    .populate("patient", "patientId name age sex status")
    .populate("reservedBedSlot", "wardName bedType slotLabel status reservedAt occupiedAt")
    .lean();

  return res.status(200).json({ count: transfers.length, transfers });
};

const listHospitalBedSlots = async (req, res) => {
  const { hospitalId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
    return res.status(400).json({ message: "hospitalId must be a valid ObjectId" });
  }

  const filter = { hospital: hospitalId };

  if (req.query.status) {
    const status = String(req.query.status).trim();
    filter.status = status;
  }

  if (req.query.wardName) {
    filter.wardName = String(req.query.wardName).trim();
  }

  if (req.query.bedType) {
    const normalized = normalizeBedType(req.query.bedType);
    const slotType = slotTypeFromBedType(normalized);
    if (slotType) {
      filter.bedType = slotType;
    } else if (SLOT_TYPES.includes(String(req.query.bedType))) {
      filter.bedType = String(req.query.bedType);
    }
  }

  const bedSlots = await BedSlot.find(filter)
    .sort({ wardName: 1, bedType: 1, slotLabel: 1 })
    .populate("reservedForPatient", "patientId name age sex status")
    .populate("reservedForTransfer", "status patientName")
    .lean();

  return res.status(200).json({ count: bedSlots.length, bedSlots });
};

const assignPatientToBedSlot = async (req, res) => {
  const { hospitalId, slotId } = req.params;
  const { patientName, patientId, patientAge, patientSex, requiredBedType, actor } = req.body;

  if (!mongoose.Types.ObjectId.isValid(hospitalId) || !mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({ message: "hospitalId and slotId must be valid ObjectIds" });
  }

  if (!patientName) {
    return res.status(400).json({ message: "patientName is required" });
  }

  let updatedSlot = null;
  let updatedPatient = null;
  let normalizedResourceKey = null;
  let hospitalRegion = "";

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const hospital = await withSession(Hospital.findById(hospitalId), session);
      if (!hospital) {
        throw new Error("Hospital not found");
      }

      hospitalRegion = hospital.region || hospital.location?.state || "";

      const slot = await withSession(BedSlot.findOne({ _id: slotId, hospital: hospitalId }), session);
      if (!slot) {
        throw new Error("Bed slot not found");
      }

      if (slot.status !== "Vacant") {
        throw new Error("Only vacant bed slots can be assigned directly");
      }

      normalizedResourceKey = normalizedBedTypeFromSlotType(slot.bedType);
      const patientBedType = normalizeBedType(requiredBedType) || normalizedResourceKey || "generalBeds";

      const patient = await upsertPatient({
        patientName,
        patientId,
        requiredBedType: patientBedType,
        fromHospitalId: hospital._id,
        patientAge,
        patientSex,
        session
      });

      patient.currentHospital = hospital._id;
      patient.status = "admitted";
      patient.requiredBedType = patientBedType;
      await saveWithSession(patient, session);

      if (normalizedResourceKey) {
        const currentAvailable = Number(hospital.resources?.[normalizedResourceKey] || 0);
        if (currentAvailable <= 0) {
          throw new Error("No available hospital capacity for this bed type");
        }
        hospital.resources[normalizedResourceKey] = currentAvailable - 1;
        await saveWithSession(hospital, session);
      }

      slot.status = "Occupied";
      slot.occupiedAt = new Date();
      slot.releasedAt = null;
      slot.reservedAt = null;
      slot.reservedForPatient = patient._id;
      slot.reservedForTransfer = null;
      await saveWithSession(slot, session);

      return { slot, patient };
    });

    updatedSlot = result.slot;
    updatedPatient = result.patient;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("not found")) {
      return res.status(404).json({ message });
    }
    if (message.includes("vacant") || message.includes("capacity")) {
      return res.status(409).json({ message });
    }

    throw error;
  }

  await createAuditLog({
    entityType: "bed_slot",
    entityId: updatedSlot._id,
    action: "patient_assigned_to_bed",
    actor: getRequester(actor),
    metadata: {
      patientId: updatedPatient._id,
      patientName: updatedPatient.name,
      hospitalId,
      wardName: updatedSlot.wardName,
      slotLabel: updatedSlot.slotLabel,
      bedType: normalizedResourceKey || updatedSlot.bedType
    }
  });

  emitBedSlotLifecycleEvent(req, {
    eventName: BED_SLOT_SOCKET_EVENTS.OCCUPIED,
    hospitalId,
    region: hospitalRegion,
    slot: updatedSlot,
    previousStatus: "Vacant",
    patientId: updatedPatient?._id,
    requiredBedType: normalizedResourceKey || normalizedBedTypeFromSlotType(updatedSlot?.bedType),
    reservationStatus: "occupied",
    note: "Bed occupied via direct assignment"
  });

  return res.status(200).json({
    bedSlot: updatedSlot,
    patient: {
      id: updatedPatient._id,
      patientId: updatedPatient.patientId,
      name: updatedPatient.name,
      age: updatedPatient.age,
      sex: updatedPatient.sex,
      status: updatedPatient.status
    }
  });
};

const releaseBedSlot = async (req, res) => {
  const { hospitalId, slotId } = req.params;
  const { actor, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(hospitalId) || !mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({ message: "hospitalId and slotId must be valid ObjectIds" });
  }

  let releasedSlot = null;
  let previousStatus = null;
  let hospitalRegion = "";
  let previousTransferId = null;
  let previousPatientId = null;

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const hospital = await withSession(Hospital.findById(hospitalId), session);
      if (!hospital) {
        throw new Error("Hospital not found");
      }

      hospitalRegion = hospital.region || hospital.location?.state || "";

      const slot = await withSession(BedSlot.findOne({ _id: slotId, hospital: hospitalId }), session);
      if (!slot) {
        throw new Error("Bed slot not found");
      }

      previousStatus = slot.status;
      previousTransferId = slot.reservedForTransfer || null;
      previousPatientId = slot.reservedForPatient || null;

      if (!["Occupied", "Reserved"].includes(slot.status)) {
        throw new Error("Only occupied or reserved slots can be released");
      }

      const normalizedResourceKey = normalizedBedTypeFromSlotType(slot.bedType);
      if (normalizedResourceKey) {
        hospital.resources[normalizedResourceKey] = Number(hospital.resources?.[normalizedResourceKey] || 0) + 1;
        await saveWithSession(hospital, session);
      }

      if (slot.reservedForPatient) {
        const patient = await withSession(Patient.findById(slot.reservedForPatient), session);
        if (patient) {
          patient.currentHospital = null;
          patient.status = "discharged";
          await saveWithSession(patient, session);
        }
      }

      if (slot.reservedForTransfer) {
        const transfer = await withSession(Transfer.findById(slot.reservedForTransfer), session);
        if (transfer && !["completed", "cancelled"].includes(transfer.status)) {
          transfer.status = "cancelled";
          transfer.reservationStatus = "released";
          transfer.timeline.push({
            status: "cancelled",
            note: note || "Bed reservation released by bed manager"
          });
          await saveWithSession(transfer, session);

          if (transfer.patient) {
            const transferPatient = await withSession(Patient.findById(transfer.patient), session);
            if (transferPatient) {
              transferPatient.status = "cancelled";
              await saveWithSession(transferPatient, session);
            }
          }
        }
      }

      slot.status = "Vacant";
      slot.releasedAt = new Date();
      slot.occupiedAt = null;
      slot.reservedAt = null;
      slot.reservedForPatient = null;
      slot.reservedForTransfer = null;
      await saveWithSession(slot, session);

      return slot;
    });

    releasedSlot = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");
    if (message.includes("not found")) {
      return res.status(404).json({ message });
    }
    if (message.includes("Only occupied or reserved")) {
      return res.status(409).json({ message });
    }
    throw error;
  }

  await createAuditLog({
    entityType: "bed_slot",
    entityId: releasedSlot._id,
    action: "bed_released",
    actor: getRequester(actor),
    metadata: {
      hospitalId,
      wardName: releasedSlot.wardName,
      slotLabel: releasedSlot.slotLabel,
      note: note || ""
    }
  });

  emitBedSlotLifecycleEvent(req, {
    eventName: BED_SLOT_SOCKET_EVENTS.RELEASED,
    hospitalId,
    region: hospitalRegion,
    slot: releasedSlot,
    previousStatus,
    transferId: previousTransferId,
    patientId: previousPatientId,
    requiredBedType: normalizedBedTypeFromSlotType(releasedSlot?.bedType),
    reservationStatus: "released",
    note: note || "Bed released"
  });

  return res.status(200).json({ bedSlot: releasedSlot });
};

const updateBedSlotStatus = async (req, res) => {
  const { hospitalId, slotId } = req.params;
  const { status, actor, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(hospitalId) || !mongoose.Types.ObjectId.isValid(slotId)) {
    return res.status(400).json({ message: "hospitalId and slotId must be valid ObjectIds" });
  }

  const nextStatus = String(status || "").trim();
  if (!["Vacant", "Reserved", "Maintenance", "Unavailable"].includes(nextStatus)) {
    return res.status(400).json({
      message: "status must be one of: Vacant, Reserved, Maintenance, Unavailable"
    });
  }

  let updatedSlot = null;
  let previousStatus = null;
  let hospitalRegion = "";

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const hospital = await withSession(Hospital.findById(hospitalId), session);
      if (!hospital) {
        throw new Error("Hospital not found");
      }

      hospitalRegion = hospital.region || hospital.location?.state || "";

      const slot = await withSession(BedSlot.findOne({ _id: slotId, hospital: hospitalId }), session);
      if (!slot) {
        throw new Error("Bed slot not found");
      }

      previousStatus = slot.status;

      if (slot.status === "Occupied") {
        throw new Error("Occupied slots must be released before status override");
      }

      if (slot.status === "Reserved" && nextStatus !== "Vacant") {
        throw new Error("Reserved slots can only be moved back to Vacant here");
      }

      const normalizedResourceKey = normalizedBedTypeFromSlotType(slot.bedType);
      if (normalizedResourceKey) {
        const wasAvailable = slot.status === "Vacant";
        const willBeAvailable = nextStatus === "Vacant";
        if (wasAvailable && !willBeAvailable) {
          const currentAvailable = Number(hospital.resources?.[normalizedResourceKey] || 0);
          if (currentAvailable <= 0) {
            throw new Error("No available hospital capacity for this bed type");
          }
          hospital.resources[normalizedResourceKey] = currentAvailable - 1;
          await saveWithSession(hospital, session);
        } else if (!wasAvailable && willBeAvailable) {
          hospital.resources[normalizedResourceKey] = Number(hospital.resources?.[normalizedResourceKey] || 0) + 1;
          await saveWithSession(hospital, session);
        }
      }

      slot.status = nextStatus;
      if (nextStatus === "Reserved") {
        slot.reservedAt = new Date();
        slot.releasedAt = null;
      }
      if (nextStatus === "Vacant") {
        slot.releasedAt = new Date();
        slot.reservedAt = null;
        slot.reservedForPatient = null;
        slot.reservedForTransfer = null;
      }

      await saveWithSession(slot, session);
      return slot;
    });

    updatedSlot = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");
    if (message.includes("not found")) {
      return res.status(404).json({ message });
    }
    if (
      message.includes("Occupied slots") ||
      message.includes("Reserved slots") ||
      message.includes("available hospital capacity")
    ) {
      return res.status(409).json({ message });
    }
    throw error;
  }

  await createAuditLog({
    entityType: "bed_slot",
    entityId: updatedSlot._id,
    action: "bed_status_updated_manual",
    actor: getRequester(actor),
    metadata: {
      hospitalId,
      wardName: updatedSlot.wardName,
      slotLabel: updatedSlot.slotLabel,
      status: updatedSlot.status,
      note: note || ""
    }
  });

  if (updatedSlot.status === "Reserved") {
    emitBedSlotLifecycleEvent(req, {
      eventName: BED_SLOT_SOCKET_EVENTS.RESERVED,
      hospitalId,
      region: hospitalRegion,
      slot: updatedSlot,
      previousStatus,
      requiredBedType: normalizedBedTypeFromSlotType(updatedSlot?.bedType),
      reservationStatus: "reserved",
      note: note || "Bed manually set to reserved"
    });
  } else if (updatedSlot.status === "Vacant" && previousStatus === "Reserved") {
    emitBedSlotLifecycleEvent(req, {
      eventName: BED_SLOT_SOCKET_EVENTS.RELEASED,
      hospitalId,
      region: hospitalRegion,
      slot: updatedSlot,
      previousStatus,
      requiredBedType: normalizedBedTypeFromSlotType(updatedSlot?.bedType),
      reservationStatus: "released",
      note: note || "Reserved bed moved back to vacant"
    });
  } else {
    emitBedSlotLifecycleEvent(req, {
      eventName: BED_SLOT_SOCKET_EVENTS.STATUS_CHANGED,
      hospitalId,
      region: hospitalRegion,
      slot: updatedSlot,
      previousStatus,
      requiredBedType: normalizedBedTypeFromSlotType(updatedSlot?.bedType),
      reservationStatus: "manual_update",
      note: note || "Bed status manually updated"
    });
  }

  return res.status(200).json({ bedSlot: updatedSlot });
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
  let destinationOccupiedSlot = null;
  let destinationReleasedSlot = null;
  let sourceReleasedSlot = null;

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
        destinationOccupiedSlot = occupiedSlot;

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

        const sourceSlot = await releaseOneOccupiedSourceBedSlot({
          hospitalId: transferDoc.fromHospital._id,
          normalizedBedType: bedType,
          session
        });
        sourceReleasedSlot = sourceSlot;

        if (transferDoc.patient) {
          transferDoc.patient.currentHospital = transferDoc.toHospital._id;
          transferDoc.patient.status = "admitted";
          await saveWithSession(transferDoc.patient, session);
        }

        if (transferDoc.assignedDriver) {
          transferDoc.dispatchStatus = "accepted";
          transferDoc.driverWorkflowStatus = "handover_complete";
          transferDoc.dispatchMeta.lastStatusAt = new Date();
          transferDoc.driverTimeline.push({
            status: "handover_complete",
            note: "Patient handover completed"
          });
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
            destinationReleasedSlot = releasedSlot;
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

        if (transferDoc.assignedDriver) {
          if (transferDoc.dispatchStatus === "pending_driver") {
            transferDoc.dispatchStatus = "rejected";
            transferDoc.dispatchMeta.rejectedAt = new Date();
          }

          transferDoc.driverWorkflowStatus = "idle";
          transferDoc.dispatchMeta.lastStatusAt = new Date();
          transferDoc.driverTimeline.push({
            status: "idle",
            note: "Dispatch cancelled"
          });
        }
      }

      if (["completed", "cancelled"].includes(finalStatus) && transferDoc.assignedAmbulance) {
        const assignedAmbulance = await withSession(
          Ambulance.findById(transferDoc.assignedAmbulance),
          session
        );

        if (assignedAmbulance) {
          assignedAmbulance.status = "available";
          await saveWithSession(assignedAmbulance, session);
          await syncHospitalAmbulanceAvailability({ hospitalId: assignedAmbulance.hospital, session });
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

    if (destinationOccupiedSlot) {
      emitBedSlotLifecycleEvent(req, {
        eventName: BED_SLOT_SOCKET_EVENTS.OCCUPIED,
        hospitalId: transfer.toHospital?._id,
        region: transfer.toHospital?.region,
        slot: destinationOccupiedSlot,
        previousStatus: "Reserved",
        transferId: transfer._id,
        patientId: transfer.patient?._id,
        requiredBedType: transfer.requiredBedType,
        reservationStatus: "occupied",
        note: "Transfer completed and destination slot occupied"
      });
    }

    if (sourceReleasedSlot) {
      emitBedSlotLifecycleEvent(req, {
        eventName: BED_SLOT_SOCKET_EVENTS.RELEASED,
        hospitalId: transfer.fromHospital?._id,
        region: transfer.fromHospital?.region,
        slot: sourceReleasedSlot,
        previousStatus: "Occupied",
        transferId: transfer._id,
        patientId: transfer.patient?._id,
        requiredBedType: transfer.requiredBedType,
        reservationStatus: "released_source",
        note: "Source bed released after transfer completion"
      });
    }
  }

  if (slotReleased) {
    await createAuditLog({
      entityType: "hospital",
      entityId: transfer.toHospital._id,
      action: "reserved_bed_released",
      actor: getRequester(actor),
      metadata: { bedType: transfer.requiredBedType }
    });

    if (destinationReleasedSlot) {
      emitBedSlotLifecycleEvent(req, {
        eventName: BED_SLOT_SOCKET_EVENTS.RELEASED,
        hospitalId: transfer.toHospital?._id,
        region: transfer.toHospital?.region,
        slot: destinationReleasedSlot,
        previousStatus: "Reserved",
        transferId: transfer._id,
        patientId: transfer.patient?._id,
        requiredBedType: transfer.requiredBedType,
        reservationStatus: "released",
        note: note || "Transfer cancelled and reserved slot released"
      });
    }
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

const ensureHospitalScopedAccess = (req, hospitalId) => {
  if (!req?.user) return false;
  if (req.user.role === ROLES.GOVERNMENT_OFFICIAL) return true;
  if (!req.user.hospital) return false;
  return String(req.user.hospital) === String(hospitalId);
};

const listHospitalAmbulances = async (req, res) => {
  const { hospitalId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
    return res.status(400).json({ message: "hospitalId must be a valid ObjectId" });
  }

  if (!ensureHospitalScopedAccess(req, hospitalId)) {
    return res.status(403).json({ message: "Insufficient permissions for this hospital" });
  }

  const ambulances = await Ambulance.find({ hospital: hospitalId, active: true })
    .sort({ createdAt: -1 })
    .populate("currentDriver", "name email role hospital")
    .lean();

  return res.status(200).json({ count: ambulances.length, ambulances });
};

const createHospitalAmbulance = async (req, res) => {
  const { hospitalId } = req.params;
  const { vehicleNumber, label, currentDriverId, capabilities } = req.body;

  if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
    return res.status(400).json({ message: "hospitalId must be a valid ObjectId" });
  }

  if (!ensureHospitalScopedAccess(req, hospitalId)) {
    return res.status(403).json({ message: "Insufficient permissions for this hospital" });
  }

  if (!vehicleNumber || !String(vehicleNumber).trim()) {
    return res.status(400).json({ message: "vehicleNumber is required" });
  }

  let createdAmbulance = null;

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const hospital = await withSession(Hospital.findById(hospitalId), session);
      if (!hospital) {
        throw new Error("Hospital not found");
      }

      let currentDriver = null;
      if (currentDriverId) {
        if (!mongoose.Types.ObjectId.isValid(currentDriverId)) {
          throw new Error("currentDriverId must be a valid ObjectId");
        }

        currentDriver = await withSession(User.findById(currentDriverId), session);
        if (!currentDriver) {
          throw new Error("Driver not found");
        }

        if (currentDriver.role !== ROLES.AMBULANCE_DRIVER) {
          throw new Error("currentDriverId must belong to an AMBULANCE_DRIVER");
        }

        if (!currentDriver.hospital || String(currentDriver.hospital) !== String(hospital._id)) {
          throw new Error("Driver must be linked to the same hospital");
        }

        if (!currentDriver.isActive) {
          throw new Error("Driver account must be active");
        }
      }

      const ambulanceDocs = await Ambulance.create(
        [
          {
            hospital: hospital._id,
            vehicleNumber: String(vehicleNumber).trim().toUpperCase(),
            label: String(label || "").trim(),
            currentDriver: currentDriver ? currentDriver._id : null,
            status: currentDriver ? "available" : "offline",
            capabilities: {
              hasVentilator: !!capabilities?.hasVentilator,
              hasAdvancedLifeSupport: !!capabilities?.hasAdvancedLifeSupport
            },
            createdBy: req.user?.id || null
          }
        ],
        sessionOpts(session)
      );

      const ambulance = ambulanceDocs[0];
      await syncHospitalAmbulanceAvailability({ hospitalId: hospital._id, session });

      return ambulance;
    });

    createdAmbulance = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("Hospital not found") || message.includes("Driver not found")) {
      return res.status(404).json({ message });
    }

    if (
      message.includes("valid ObjectId") ||
      message.includes("AMBULANCE_DRIVER") ||
      message.includes("same hospital") ||
      message.includes("active")
    ) {
      return res.status(400).json({ message });
    }

    if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("e11000")) {
      return res.status(409).json({ message: "vehicleNumber already exists" });
    }

    throw error;
  }

  await createAuditLog({
    entityType: "ambulance",
    entityId: createdAmbulance._id,
    action: "ambulance_created",
    actor: getRequester({ role: req.user?.role, id: req.user?.id, name: req.user?.name }),
    metadata: {
      hospitalId,
      vehicleNumber: createdAmbulance.vehicleNumber,
      status: createdAmbulance.status
    }
  });

  const ambulance = await Ambulance.findById(createdAmbulance._id)
    .populate("currentDriver", "name email role")
    .lean();

  return res.status(201).json({ ambulance });
};

const updateHospitalAmbulance = async (req, res) => {
  const { hospitalId, ambulanceId } = req.params;
  const { status, currentDriverId, active, capabilities, label } = req.body;

  if (!mongoose.Types.ObjectId.isValid(hospitalId) || !mongoose.Types.ObjectId.isValid(ambulanceId)) {
    return res.status(400).json({ message: "hospitalId and ambulanceId must be valid ObjectIds" });
  }

  if (!ensureHospitalScopedAccess(req, hospitalId)) {
    return res.status(403).json({ message: "Insufficient permissions for this hospital" });
  }

  let updatedAmbulance = null;

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const ambulance = await withSession(
        Ambulance.findOne({ _id: ambulanceId, hospital: hospitalId }),
        session
      );
      if (!ambulance) {
        throw new Error("Ambulance not found");
      }

      if (label !== undefined) {
        ambulance.label = String(label || "").trim();
      }

      if (active !== undefined) {
        ambulance.active = Boolean(active);
      }

      if (capabilities && typeof capabilities === "object") {
        if (Object.prototype.hasOwnProperty.call(capabilities, "hasVentilator")) {
          ambulance.capabilities.hasVentilator = !!capabilities.hasVentilator;
        }
        if (Object.prototype.hasOwnProperty.call(capabilities, "hasAdvancedLifeSupport")) {
          ambulance.capabilities.hasAdvancedLifeSupport = !!capabilities.hasAdvancedLifeSupport;
        }
      }

      if (currentDriverId !== undefined) {
        if (!currentDriverId) {
          ambulance.currentDriver = null;
        } else {
          if (!mongoose.Types.ObjectId.isValid(currentDriverId)) {
            throw new Error("currentDriverId must be a valid ObjectId");
          }

          const driver = await withSession(User.findById(currentDriverId), session);
          if (!driver) {
            throw new Error("Driver not found");
          }

          if (driver.role !== ROLES.AMBULANCE_DRIVER) {
            throw new Error("currentDriverId must belong to an AMBULANCE_DRIVER");
          }

          if (!driver.hospital || String(driver.hospital) !== String(hospitalId)) {
            throw new Error("Driver must be linked to the same hospital");
          }

          if (!driver.isActive) {
            throw new Error("Driver account must be active");
          }

          ambulance.currentDriver = driver._id;
        }
      }

      if (status !== undefined) {
        const nextStatus = String(status).trim().toLowerCase();
        if (!["available", "assigned", "in_service", "offline"].includes(nextStatus)) {
          throw new Error("status must be one of: available, assigned, in_service, offline");
        }
        ambulance.status = nextStatus;
      }

      if (!ambulance.active) {
        ambulance.status = "offline";
      }

      if (!ambulance.currentDriver && ambulance.status === "available") {
        ambulance.status = "offline";
      }

      await saveWithSession(ambulance, session);
      await syncHospitalAmbulanceAvailability({ hospitalId, session });

      return ambulance;
    });

    updatedAmbulance = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("Ambulance not found") || message.includes("Driver not found")) {
      return res.status(404).json({ message });
    }

    if (message.includes("valid ObjectId") || message.includes("same hospital") || message.includes("status must") || message.includes("active") || message.includes("AMBULANCE_DRIVER")) {
      return res.status(400).json({ message });
    }

    throw error;
  }

  await createAuditLog({
    entityType: "ambulance",
    entityId: updatedAmbulance._id,
    action: "ambulance_updated",
    actor: getRequester({ role: req.user?.role, id: req.user?.id, name: req.user?.name }),
    metadata: {
      hospitalId,
      status: updatedAmbulance.status,
      active: updatedAmbulance.active,
      currentDriver: updatedAmbulance.currentDriver
    }
  });

  const ambulance = await Ambulance.findById(updatedAmbulance._id)
    .populate("currentDriver", "name email role")
    .lean();

  return res.status(200).json({ ambulance });
};

const assignTransferDispatch = async (req, res) => {
  const { transferId } = req.params;
  const { ambulanceId, driverId, actor } = req.body;

  if (!mongoose.Types.ObjectId.isValid(transferId)) {
    return res.status(400).json({ message: "transferId must be a valid ObjectId" });
  }

  let updatedTransfer = null;
  let hospitalRegion = "";

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const transfer = await withSession(
        Transfer.findById(transferId).populate("toHospital"),
        session
      );

      if (!transfer) {
        throw new Error("Transfer not found");
      }

      if (["completed", "cancelled"].includes(transfer.status)) {
        throw new Error("Cannot assign dispatch for completed or cancelled transfers");
      }

      if (!ensureHospitalScopedAccess(req, transfer.toHospital?._id)) {
        throw new Error("Insufficient permissions for transfer destination hospital");
      }

      hospitalRegion = transfer.toHospital?.region || transfer.toHospital?.location?.state || "";

      let ambulance = null;
      if (ambulanceId) {
        if (!mongoose.Types.ObjectId.isValid(ambulanceId)) {
          throw new Error("ambulanceId must be a valid ObjectId");
        }

        ambulance = await withSession(
          Ambulance.findOne({
            _id: ambulanceId,
            hospital: transfer.toHospital._id,
            active: true
          }),
          session
        );
      } else {
        ambulance = await withSession(
          Ambulance.findOne({
            hospital: transfer.toHospital._id,
            active: true,
            status: "available"
          }).sort({ updatedAt: 1 }),
          session
        );
      }

      if (!ambulance) {
        throw new Error("No eligible ambulance found for assignment");
      }

      let driver = null;
      if (driverId) {
        if (!mongoose.Types.ObjectId.isValid(driverId)) {
          throw new Error("driverId must be a valid ObjectId");
        }

        driver = await withSession(User.findById(driverId), session);
      } else if (ambulance.currentDriver) {
        driver = await withSession(User.findById(ambulance.currentDriver), session);
      }

      if (!driver) {
        throw new Error("No eligible driver found for assignment");
      }

      if (driver.role !== ROLES.AMBULANCE_DRIVER) {
        throw new Error("Assigned driver must have AMBULANCE_DRIVER role");
      }

      if (!driver.hospital || String(driver.hospital) !== String(transfer.toHospital._id)) {
        throw new Error("Assigned driver must belong to destination hospital");
      }

      if (!driver.isActive) {
        throw new Error("Assigned driver must be active");
      }

      if (transfer.assignedAmbulance && String(transfer.assignedAmbulance) !== String(ambulance._id)) {
        const previousAmbulance = await withSession(Ambulance.findById(transfer.assignedAmbulance), session);
        if (previousAmbulance && previousAmbulance.active) {
          previousAmbulance.status = "available";
          await saveWithSession(previousAmbulance, session);
        }
      }

      transfer.assignedAmbulance = ambulance._id;
      transfer.assignedDriver = driver._id;
      transfer.dispatchStatus = "pending_driver";
      transfer.driverWorkflowStatus = "idle";
      transfer.dispatchMeta.assignedAt = new Date();
      transfer.dispatchMeta.respondedAt = null;
      transfer.dispatchMeta.acceptedAt = null;
      transfer.dispatchMeta.rejectedAt = null;
      transfer.dispatchMeta.rejectionReason = "";
      transfer.dispatchMeta.lastStatusAt = new Date();
      transfer.driverTimeline.push({ status: "idle", note: "Dispatch manually assigned" });

      ambulance.currentDriver = driver._id;
      ambulance.status = "assigned";

      await saveWithSession(ambulance, session);
      await saveWithSession(transfer, session);
      await syncHospitalAmbulanceAvailability({ hospitalId: transfer.toHospital._id, session });

      return transfer;
    });

    updatedTransfer = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("not found") || message.includes("No eligible")) {
      return res.status(404).json({ message });
    }

    if (message.includes("valid ObjectId") || message.includes("Cannot assign") || message.includes("Insufficient permissions") || message.includes("role") || message.includes("destination hospital") || message.includes("active")) {
      return res.status(400).json({ message });
    }

    throw error;
  }

  await createAuditLog({
    entityType: "transfer",
    entityId: updatedTransfer._id,
    action: "dispatch_assigned",
    actor: getRequester(actor || { role: req.user?.role, id: req.user?.id, name: req.user?.name }),
    metadata: {
      assignedDriver: updatedTransfer.assignedDriver,
      assignedAmbulance: updatedTransfer.assignedAmbulance,
      dispatchStatus: updatedTransfer.dispatchStatus
    }
  });

  const transfer = await Transfer.findById(updatedTransfer._id)
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region")
    .populate("assignedAmbulance", "vehicleNumber label status")
    .populate("assignedDriver", "name email role")
    .populate("reservedBedSlot", "wardName bedType slotLabel status")
    .lean();

  emitDispatchEvent(req, {
    eventName: DISPATCH_SOCKET_EVENTS.ASSIGNED,
    hospitalId: transfer?.toHospital?._id,
    region: transfer?.toHospital?.region || hospitalRegion,
    driverId: transfer?.assignedDriver?._id,
    payload: {
      transferId: String(transfer?._id),
      patientName: transfer?.patientName,
      fromHospital: transfer?.fromHospital,
      toHospital: transfer?.toHospital,
      requiredBedType: transfer?.requiredBedType,
      dispatchStatus: transfer?.dispatchStatus,
      assignedAmbulance: transfer?.assignedAmbulance,
      assignedDriver: transfer?.assignedDriver
    }
  });

  return res.status(200).json({ transfer });
};

const listDriverDispatches = async (req, res) => {
  const driverId = req.user?.id;
  const mode = String(req.query.mode || "active").trim().toLowerCase();

  if (!driverId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const query = { assignedDriver: driverId };

  if (mode === "history") {
    query.$or = [
      { status: { $in: ["completed", "cancelled"] } },
      { dispatchStatus: "rejected" },
      { driverWorkflowStatus: "handover_complete" }
    ];
  } else {
    query.status = { $in: ["requested", "dispatched", "in_transit"] };
    query.driverWorkflowStatus = { $ne: "handover_complete" };
  }

  const transfers = await Transfer.find(query)
    .sort({ createdAt: -1 })
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region")
    .populate("assignedAmbulance", "vehicleNumber label status")
    .populate("reservedBedSlot", "wardName bedType slotLabel status")
    .lean();

  return res.status(200).json({ count: transfers.length, transfers });
};

const respondToDriverDispatch = async (req, res) => {
  const driverId = req.user?.id;
  const { transferId } = req.params;
  const { action, reason, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(transferId)) {
    return res.status(400).json({ message: "transferId must be a valid ObjectId" });
  }

  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!["accept", "reject"].includes(normalizedAction)) {
    return res.status(400).json({ message: "action must be either accept or reject" });
  }

  let updatedTransfer = null;
  let hospitalRegion = "";

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const transfer = await withSession(
        Transfer.findById(transferId)
          .populate("toHospital")
          .populate("assignedAmbulance"),
        session
      );

      if (!transfer) {
        throw new Error("Transfer not found");
      }

      if (!transfer.assignedDriver || String(transfer.assignedDriver) !== String(driverId)) {
        throw new Error("Dispatch is not assigned to this driver");
      }

      if (transfer.dispatchStatus !== "pending_driver") {
        throw new Error("Dispatch has already been responded to");
      }

      hospitalRegion = transfer.toHospital?.region || transfer.toHospital?.location?.state || "";

      transfer.dispatchMeta.respondedAt = new Date();
      transfer.dispatchMeta.lastStatusAt = new Date();

      if (normalizedAction === "accept") {
        transfer.dispatchStatus = "accepted";
        transfer.dispatchMeta.acceptedAt = new Date();
        transfer.driverWorkflowStatus = "idle";

        if (transfer.status === "requested") {
          transfer.status = "dispatched";
          transfer.timeline.push({ status: "dispatched", note: note || "Dispatch accepted by ambulance driver" });
        }

        transfer.driverTimeline.push({ status: "idle", note: note || "Dispatch accepted" });

        if (transfer.assignedAmbulance) {
          transfer.assignedAmbulance.status = "in_service";
          await saveWithSession(transfer.assignedAmbulance, session);
        }
      } else {
        transfer.dispatchStatus = "rejected";
        transfer.dispatchMeta.rejectedAt = new Date();
        transfer.dispatchMeta.rejectionReason = String(reason || note || "").trim();
        transfer.driverWorkflowStatus = "idle";
        transfer.driverTimeline.push({ status: "idle", note: note || "Dispatch rejected" });

        if (transfer.assignedAmbulance) {
          transfer.assignedAmbulance.status = "available";
          await saveWithSession(transfer.assignedAmbulance, session);
          await syncHospitalAmbulanceAvailability({ hospitalId: transfer.assignedAmbulance.hospital, session });
        }
      }

      await saveWithSession(transfer, session);
      return transfer;
    });

    updatedTransfer = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("Transfer not found")) {
      return res.status(404).json({ message });
    }

    if (message.includes("not assigned") || message.includes("already been responded")) {
      return res.status(409).json({ message });
    }

    throw error;
  }

  await createAuditLog({
    entityType: "transfer",
    entityId: updatedTransfer._id,
    action: "dispatch_responded",
    actor: getRequester({ role: req.user?.role, id: req.user?.id, name: req.user?.name }),
    metadata: {
      action: normalizedAction,
      dispatchStatus: updatedTransfer.dispatchStatus,
      reason: reason || note || ""
    }
  });

  const transfer = await Transfer.findById(updatedTransfer._id)
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region")
    .populate("assignedAmbulance", "vehicleNumber label status")
    .populate("assignedDriver", "name email role")
    .populate("reservedBedSlot", "wardName bedType slotLabel status")
    .lean();

  emitDispatchEvent(req, {
    eventName: DISPATCH_SOCKET_EVENTS.RESPONDED,
    hospitalId: transfer?.toHospital?._id,
    region: transfer?.toHospital?.region || hospitalRegion,
    driverId: req.user?.id,
    payload: {
      transferId: String(transfer?._id),
      action: normalizedAction,
      dispatchStatus: transfer?.dispatchStatus,
      reason: reason || note || "",
      driverWorkflowStatus: transfer?.driverWorkflowStatus,
      assignedAmbulance: transfer?.assignedAmbulance
    }
  });

  return res.status(200).json({ transfer });
};

const updateDriverDispatchProgress = async (req, res) => {
  const driverId = req.user?.id;
  const { transferId } = req.params;
  const { status, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(transferId)) {
    return res.status(400).json({ message: "transferId must be a valid ObjectId" });
  }

  const normalizedKey = String(status || "").trim().toUpperCase();
  const nextWorkflowStatus = DRIVER_PROGRESS_STATUS_MAP[normalizedKey];

  if (!nextWorkflowStatus) {
    return res.status(400).json({ message: "status must be one of: EN_ROUTE, ARRIVED, IN_TRANSIT, HANDOVER_COMPLETE" });
  }

  let updatedTransfer = null;
  let hospitalRegion = "";

  try {
    const result = await runWithOptionalTransaction(async (session) => {
      const transfer = await withSession(
        Transfer.findById(transferId)
          .populate("toHospital")
          .populate("patient")
          .populate("assignedAmbulance"),
        session
      );

      if (!transfer) {
        throw new Error("Transfer not found");
      }

      if (!transfer.assignedDriver || String(transfer.assignedDriver) !== String(driverId)) {
        throw new Error("Dispatch is not assigned to this driver");
      }

      if (transfer.dispatchStatus !== "accepted") {
        throw new Error("Dispatch must be accepted before status updates");
      }

      if (["completed", "cancelled"].includes(transfer.status)) {
        throw new Error("Transfer is already closed");
      }

      hospitalRegion = transfer.toHospital?.region || transfer.toHospital?.location?.state || "";

      transfer.driverWorkflowStatus = nextWorkflowStatus;
      transfer.dispatchMeta.lastStatusAt = new Date();
      transfer.driverTimeline.push({ status: nextWorkflowStatus, note: note || "" });

      if (nextWorkflowStatus === "in_transit" && transfer.status !== "in_transit") {
        transfer.status = "in_transit";
        transfer.timeline.push({ status: "in_transit", note: note || "Ambulance in transit" });
        if (transfer.patient) {
          transfer.patient.status = "in_transit";
          await saveWithSession(transfer.patient, session);
        }
      }

      if (nextWorkflowStatus === "handover_complete") {
        transfer.timeline.push({ status: transfer.status, note: note || "Driver marked handover complete" });

        if (transfer.assignedAmbulance) {
          transfer.assignedAmbulance.status = "available";
          await saveWithSession(transfer.assignedAmbulance, session);
          await syncHospitalAmbulanceAvailability({
            hospitalId: transfer.assignedAmbulance.hospital,
            session
          });
        }
      }

      await saveWithSession(transfer, session);
      return transfer;
    });

    updatedTransfer = result;
  } catch (error) {
    const message = String(error && error.message ? error.message : "");

    if (message.includes("Transfer not found")) {
      return res.status(404).json({ message });
    }

    if (
      message.includes("not assigned") ||
      message.includes("must be accepted") ||
      message.includes("already closed")
    ) {
      return res.status(409).json({ message });
    }

    throw error;
  }

  await createAuditLog({
    entityType: "transfer",
    entityId: updatedTransfer._id,
    action: "dispatch_progress_updated",
    actor: getRequester({ role: req.user?.role, id: req.user?.id, name: req.user?.name }),
    metadata: {
      status: updatedTransfer.driverWorkflowStatus,
      note: note || ""
    }
  });

  const transfer = await Transfer.findById(updatedTransfer._id)
    .populate("fromHospital", "name region")
    .populate("toHospital", "name region")
    .populate("assignedAmbulance", "vehicleNumber label status")
    .populate("assignedDriver", "name email role")
    .populate("reservedBedSlot", "wardName bedType slotLabel status")
    .lean();

  emitDispatchEvent(req, {
    eventName: DISPATCH_SOCKET_EVENTS.PROGRESS,
    hospitalId: transfer?.toHospital?._id,
    region: transfer?.toHospital?.region || hospitalRegion,
    driverId: req.user?.id,
    payload: {
      transferId: String(transfer?._id),
      driverWorkflowStatus: transfer?.driverWorkflowStatus,
      transferStatus: transfer?.status,
      note: note || ""
    }
  });

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
  listOpenTransfersForHospital,
  listHospitalBedSlots,
  assignPatientToBedSlot,
  releaseBedSlot,
  updateBedSlotStatus,
  getTransferHistory,
  trackTransfer,
  updateTransferStatus,
  listHospitalAmbulances,
  createHospitalAmbulance,
  updateHospitalAmbulance,
  assignTransferDispatch,
  listDriverDispatches,
  respondToDriverDispatch,
  updateDriverDispatchProgress,
  updateHospitalResources
};

const BedSlot = require("../models/BedSlot");
const Resource = require("../models/Resource");

const SLOT_TYPE_BY_NORMALIZED = {
  generalBeds: "General",
  icuBeds: "ICU",
  ventilatorBeds: "Ventilator"
};

const withSession = (query, session) => (session ? query.session(session) : query);

const saveWithSession = (doc, session) => (session ? doc.save({ session }) : doc.save());

const slotTypeFromBedType = (normalizedBedType) => SLOT_TYPE_BY_NORMALIZED[normalizedBedType] || null;

const buildSlotSeedDocs = (resource) => {
  const seedDocs = [];

  for (const ward of resource.wards || []) {
    for (const bed of ward.beds || []) {
      const slotCount = Number(bed.count || 0);
      if (!slotCount || slotCount < 0) continue;

      for (let i = 1; i <= slotCount; i += 1) {
        seedDocs.push({
          hospital: resource.hospital,
          region: resource.region,
          wardName: ward.wardName,
          bedType: bed.type,
          slotLabel: `${ward.wardName}-${bed.type}-${i}`,
          status: bed.status
        });
      }
    }
  }

  return seedDocs;
};

const ensureBedSlotsInitialized = async ({ hospitalId, session }) => {
  const existingCount = await withSession(BedSlot.countDocuments({ hospital: hospitalId }), session);
  if (existingCount > 0) {
    return;
  }

  const resource = await withSession(Resource.findOne({ hospital: hospitalId }), session);
  if (!resource) {
    return;
  }

  const docs = buildSlotSeedDocs(resource);
  if (!docs.length) {
    return;
  }

  await BedSlot.insertMany(docs, {
    session,
    ordered: false
  });
};

const reserveBedSlot = async ({ hospitalId, normalizedBedType, transferId, patientId, session }) => {
  const slotType = slotTypeFromBedType(normalizedBedType);
  if (!slotType) {
    return null;
  }

  await ensureBedSlotsInitialized({ hospitalId, session });

  const query = BedSlot.findOneAndUpdate(
    {
      hospital: hospitalId,
      bedType: slotType,
      status: "Vacant"
    },
    {
      $set: {
        status: "Reserved",
        reservedAt: new Date(),
        reservedForTransfer: transferId || null,
        reservedForPatient: patientId || null,
        releasedAt: null
      }
    },
    {
      new: true,
      sort: { updatedAt: 1 }
    }
  );

  return withSession(query, session);
};

const occupyReservedBedSlot = async ({ bedSlotId, transferId, patientId, session }) => {
  const query = BedSlot.findOneAndUpdate(
    {
      _id: bedSlotId,
      status: "Reserved",
      reservedForTransfer: transferId
    },
    {
      $set: {
        status: "Occupied",
        occupiedAt: new Date(),
        reservedForPatient: patientId || null,
        releasedAt: null
      }
    },
    { new: true }
  );

  return withSession(query, session);
};

const releaseReservedBedSlot = async ({ bedSlotId, transferId, session }) => {
  const query = BedSlot.findOneAndUpdate(
    {
      _id: bedSlotId,
      status: "Reserved",
      reservedForTransfer: transferId
    },
    {
      $set: {
        status: "Vacant",
        releasedAt: new Date(),
        reservedForTransfer: null,
        reservedForPatient: null,
        reservedAt: null
      }
    },
    { new: true }
  );

  return withSession(query, session);
};

const releaseOneOccupiedSourceBedSlot = async ({ hospitalId, normalizedBedType, session }) => {
  const slotType = slotTypeFromBedType(normalizedBedType);
  if (!slotType) return null;

  const query = BedSlot.findOneAndUpdate(
    {
      hospital: hospitalId,
      bedType: slotType,
      status: "Occupied"
    },
    {
      $set: {
        status: "Vacant",
        releasedAt: new Date(),
        occupiedAt: null,
        reservedForTransfer: null,
        reservedForPatient: null,
        reservedAt: null
      }
    },
    {
      new: true,
      sort: { updatedAt: 1 }
    }
  );

  return withSession(query, session);
};

module.exports = {
  slotTypeFromBedType,
  reserveBedSlot,
  occupyReservedBedSlot,
  releaseReservedBedSlot,
  releaseOneOccupiedSourceBedSlot
};

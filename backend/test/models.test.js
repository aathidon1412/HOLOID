const { expect } = require('chai');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Hospital = require('../src/models/Hospital');
const Patient = require('../src/models/Patient');
const BedSlot = require('../src/models/BedSlot');

describe('Model tests', () => {
  it('hashes password before save and comparePassword works', async () => {
    const u = await User.create({ name: 'Hash Test', email: 'hash@test.local', password: 'mysecret12', role: 'HOSPITAL_ADMIN' });
    expect(u.password).to.not.equal('mysecret12');
    const fetched = await User.findById(u._id).select('+password');
    const match = await fetched.comparePassword('mysecret12');
    expect(match).to.be.true;
  });

  it('creates hospital with geo coordinates', async () => {
    const h = await Hospital.create({
      name: 'Test Hospital',
      registrationNumber: 'REG-001',
      location: {
        addressLine1: '123 Test St',
        city: 'Testville',
        state: 'TS',
        country: 'Testland',
        coordinates: { type: 'Point', coordinates: [77.5946, 12.9716] },
      },
      contact: { phone: '1234567890', email: 'hosp@test.local' },
      capacity: { totalBeds: 100, availableBeds: 50 },
      createdBy: new mongoose.Types.ObjectId(),
    });

    expect(h).to.exist;
    expect(h.location.coordinates.coordinates).to.be.an('array');
  });

  it('creates patient with transfer tracking fields', async () => {
    const patient = await Patient.create({
      patientId: 'P-1001',
      name: 'Case One',
      age: 44,
      sex: 'male',
      requiredBedType: 'icuBeds'
    });

    expect(patient).to.exist;
    expect(patient.status).to.equal('awaiting_transfer');
    expect(patient.requiredBedType).to.equal('icuBeds');
  });

  it('creates bed slot with reservable status', async () => {
    const hospital = await Hospital.create({
      name: 'Slot Hospital',
      registrationNumber: 'REG-002',
      location: {
        addressLine1: '456 Slot St',
        city: 'Slotville',
        state: 'SS',
        country: 'Testland',
        coordinates: { type: 'Point', coordinates: [77.1, 12.9] },
      },
      contact: { phone: '1111111111', email: 'slot@test.local' },
      capacity: { totalBeds: 20, availableBeds: 10 },
      createdBy: new mongoose.Types.ObjectId(),
    });

    const slot = await BedSlot.create({
      hospital: hospital._id,
      region: 'South',
      wardName: 'ICU-A',
      bedType: 'ICU',
      slotLabel: 'ICU-A-ICU-1',
      status: 'Vacant'
    });

    expect(slot).to.exist;
    expect(slot.status).to.equal('Vacant');
  });
});

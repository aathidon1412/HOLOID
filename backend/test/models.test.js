const { expect } = require('chai');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Hospital = require('../src/models/Hospital');

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
});

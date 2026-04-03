const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../src/app');

let mongoServer;

before(async function () {
  this.timeout(20000);
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

after(async function () {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

module.exports = { app, mongoose };

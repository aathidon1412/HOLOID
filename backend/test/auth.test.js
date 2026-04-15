const request = require('supertest');
const { expect } = require('chai');
const { app } = require('./setup');
const User = require('../src/models/User');
const tokenService = require('../src/services/tokenService');

describe('Auth integration tests', () => {
  const testUser = {
    name: 'Aathi Tester',
    email: 'aathi@test.local',
    password: 'password123',
    role: 'HOSPITAL_ADMIN',
  };

  it('registers a user without exposing activation link', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(testUser).expect(201);
    expect(res.body).to.have.property('data');
    expect(res.body.data).to.not.have.property('activationLink');
    expect(res.body.data).to.have.property('activationEmailSent');
    const created = await User.findOne({ email: testUser.email });
    expect(created).to.exist;
  });

  it('activates account using activation token and allows login', async () => {
    const regResp = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'User2', email: 'user2@test.local', password: 'password123', role: 'HOSPITAL_ADMIN' })
      .expect(201);

    const createdUser = await User.findOne({ email: 'user2@test.local' });
    expect(createdUser).to.exist;
    const token = tokenService.generateActivationToken(createdUser);

    await request(app).get(`/api/v1/auth/activate?token=${token}`).expect(200);

    const loginResp = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user2@test.local', password: 'password123' })
      .expect(200);

    expect(loginResp.body.data).to.have.property('accessToken');
    const accessToken = loginResp.body.data.accessToken;

    const verifyResp = await request(app)
      .get('/api/v1/auth/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(verifyResp.body.data).to.have.property('user');
    expect(verifyResp.body.data.user.email).to.equal('user2@test.local');
  });
});

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:4000';
  const email = `socketsmoke+${Date.now()}@example.com`;
  const password = 'Password123!';
  const region = 'smoke-region';
  const hospitalId = require('crypto').randomBytes(12).toString('hex');

  console.log('Base URL:', base);

  // Register
  const regRes = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Socket Smoke', email, password, role: 'DOCTOR' }),
  });
  const regJson = await regRes.json();
  console.log('Register:', regJson.message || regJson);

  const activationLink = regJson.data && regJson.data.activationLink;
  if (!activationLink) {
    console.error('No activation link returned; abort');
    process.exit(1);
  }

  const activationToken = new URL(activationLink).searchParams.get('token');
  await fetch(`${base}/api/v1/auth/activate?token=${encodeURIComponent(activationToken)}`);
  console.log('Activated account');

  // Login
  const loginRes = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data && loginJson.data.accessToken;
  if (!token) {
    console.error('Login failed');
    process.exit(1);
  }
  console.log('Logged in, token length:', token.length);

  // Create resource record for hospital
  const createRes = await fetch(`${base}/api/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ hospital: hospitalId, region }),
  });
  const createJson = await createRes.json();
  console.log('Created resource:', createJson && createJson.data ? createJson.data._id || createJson.data : createJson);

  // Connect socket
  const { io } = require('socket.io-client');
  const socket = io(base, { auth: { token }, transports: ['websocket'] });

  let received = { update: false, statusChanged: false };

  socket.on('connect', () => {
    console.log('Socket connected, id=', socket.id);
    socket.emit('join-region', region);
    socket.emit('subscribe-hospital', hospitalId);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connect_error', err.message);
  });

  socket.on('bed-update', (payload) => {
    console.log('Received bed-update:', payload && payload._id ? payload._id : payload);
    received.update = true;
  });

  socket.on('bed-status-changed', (payload) => {
    console.log('Received bed-status-changed:', payload);
    received.statusChanged = true;
  });

  // Wait a bit for socket to connect, then trigger bed update
  await new Promise((r) => setTimeout(r, 1000));

  const updateRes = await fetch(`${base}/api/resources/${hospitalId}/beds`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bedType: 'ICU', status: 'Occupied' }),
  });
  const updateJson = await updateRes.json();
  console.log('Update API response:', updateJson && updateJson.message ? updateJson.message : updateJson);

  // Wait up to 5s to receive events
  const timeout = Date.now() + 5000;
  while (Date.now() < timeout && !(received.update && received.statusChanged)) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('Received flags:', received);
  socket.close();

  if (received.update && received.statusChanged) {
    console.log('Socket smoke test: SUCCESS');
    process.exit(0);
  }

  console.error('Socket smoke test: FAILED to receive expected events');
  process.exit(2);
})();

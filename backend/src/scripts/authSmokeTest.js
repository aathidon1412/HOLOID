(async () => {
  const base = process.env.BASE_URL || 'http://localhost:4000';
  const email = `smoketest+${Date.now()}@example.com`;
  const password = 'Password123!';
  console.log('Base URL:', base);

  const regRes = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Tester', email, password, role: 'DOCTOR' }),
  });
  const regJson = await regRes.json();
  console.log('Register response:', regJson);

  const activationLink = regJson.data && regJson.data.activationLink;
  if (!activationLink) {
    console.error('No activationLink in register response; aborting');
    process.exit(1);
  }

  console.log('Calling activation link (backend API):', activationLink);
  // activationLink points to client app. Extract token and call backend activation endpoint.
  const url = new URL(activationLink);
  const activationToken = url.searchParams.get('token');
  const actRes = await fetch(`${base}/api/v1/auth/activate?token=${encodeURIComponent(activationToken)}`, { method: 'GET' });
  console.log('Activation status:', actRes.status);
  console.log('Activation body:', await actRes.text());

  const loginRes = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  console.log('Login response:', loginJson);

  const token = loginJson.data && loginJson.data.accessToken;
  if (!token) {
    console.error('Login failed, no token; aborting');
    process.exit(1);
  }

  const verifyRes = await fetch(`${base}/api/v1/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Verify status:', verifyRes.status, 'body:', await verifyRes.text());

  const logoutRes = await fetch(`${base}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Logout status:', logoutRes.status, 'body:', await logoutRes.text());

  process.exit(0);
})();

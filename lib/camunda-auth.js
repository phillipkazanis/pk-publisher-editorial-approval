let cached = { token: null, exp: 0 };

export async function getCamundaToken() {
  if (cached.token && Date.now() < cached.exp - 60000) return cached.token;
  const res = await fetch(process.env.CAMUNDA_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.CAMUNDA_CLIENT_ID,
      client_secret: process.env.CAMUNDA_CLIENT_SECRET,
      audience: 'zeebe.camunda.io',
    }),
  });
  if (!res.ok) throw new Error('Camunda OAuth failed: ' + res.status);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export async function camundaPost(path, body) {
  const token = await getCamundaToken();
  const res = await fetch(`${process.env.CAMUNDA_ZEEBE_REST_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Camunda ${path} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

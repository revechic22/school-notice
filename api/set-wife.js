export default async function handler(req, res) {
  if (req.method === 'GET') {
    const friends = await kvGet('kakao_friends') || [];
    return res.status(200).json({ friends });
  }

  if (req.method === 'POST') {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'uuid 필요' });
    await kvSet('kakao_wife_uuid', uuid);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}

async function kvGet(key) {
  const r = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  const { result } = await r.json();
  return result ? JSON.parse(result) : null;
}

async function kvSet(key, value) {
  await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
}

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('code 없음');

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code,
    }),
  });

  const tokens = await tokenRes.json();
  if (tokens.error) {
    return res.status(400).send(`카카오 토큰 오류: ${tokens.error_description}`);
  }

  await kvSet('kakao_access_token', tokens.access_token);
  if (tokens.refresh_token) {
    await kvSet('kakao_refresh_token', tokens.refresh_token);
  }

  try {
    const friendsRes = await fetch('https://kapi.kakao.com/v1/friends', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const friendsData = await friendsRes.json();
    await kvSet('kakao_friends', friendsData.elements || []);
  } catch (e) {
    console.error('친구 목록 조회 실패:', e.message);
  }

  res.redirect(`/?kakao=connected`);
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

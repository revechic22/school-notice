const { sendToMe, sendToFriend } = require('../lib/kakao.js');

export default async function handler(req, res) {
      if (req.method !== 'POST') return res.status(405).end();

  const { events } = req.body;
      if (!events?.length) return res.status(400).json({ error: 'events 필요' });

  let accessToken = await kvGet('kakao_access_token');
      const refreshToken = await kvGet('kakao_refresh_token');

  if (!accessToken && !refreshToken) {
          return res.status(401).json({ error: '카카오 연결 필요 - 앱에서 카카오로 연결해주세요' });
  }

  let token = accessToken;

  if (refreshToken) {
          const r = await fetch('https://kauth.kakao.com/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                                grant_type: 'refresh_token',
                                client_id: process.env.KAKAO_REST_API_KEY,
                                refresh_token: refreshToken,
                    }),
          });
          const refreshed = await r.json();
          if (refreshed.access_token) {
                    token = refreshed.access_token;
                    await kvSet('kakao_access_token', token);
          }
          if (refreshed.refresh_token) {
                    await kvSet('kakao_refresh_token', refreshed.refresh_token);
          }
  }

  if (!token) return res.status(401).json({ error: '카카오 토큰 갱신 실패' });

  const wd = ['일', '월', '화', '수', '목', '금', '토'];
      const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  let summaryText = `📋 이번 주 유치원 일정 요약\n━━━━━━━━━━━━━━\n`;

  for (const ev of sorted) {
          const d = new Date(ev.date);
          const label = `${d.getMonth() + 1}/${d.getDate()}(${wd[d.getDay()]})`;

        if (ev.type === 'holiday') {
                  summaryText += `🚫 ${label} ${ev.title}\n\n`;
        } else {
                  summaryText += `📅 ${label} ${ev.title}\n`;
                  if (ev.items?.length) summaryText += `🎒 ${ev.items.join(', ')}\n`;
                  summaryText += '\n';
        }
  }

  summaryText += `━━━━━━━━━━━━━━\n가정통신문 앱에서 자동 발송됨 🤖`;

  const wifeFriendUuid = await kvGet('kakao_wife_uuid');
      const results = [];

  const myResult = await sendToMe(token, summaryText);
      results.push({ to: 'me', result: myResult });

  if (wifeFriendUuid) {
          const wifeResult = await sendToFriend(token, wifeFriendUuid, summaryText);
          results.push({ to: 'wife', result: wifeResult });
  }

  return res.status(200).json({ sent: results.length, results });
}

async function kvGet(key) {
      const r = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
              headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      });
      const { result } = await r.json();
      if (result === null || result === undefined) return null;
      try { return JSON.parse(result); } catch { return result; }
}

async function kvSet(key, value) {
      await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
              method: 'POST',
              headers: {
                        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
                        'Content-Type': 'application/json',
              },
              body: JSON.stringify(value),
      });
}

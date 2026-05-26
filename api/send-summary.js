import { sendToMe, sendToFriend, buildNotifyText } from '../lib/kakao.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { events } = req.body;
  if (!events?.length) return res.status(400).json({ error: 'events 필요' });

  const accessToken = await kvGet('kakao_access_token');
  const refreshToken = await kvGet('kakao_refresh_token');

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ error: '카카오 토큰 없음' });
  }

  let token = accessToken;

  // 토큰 갱신 시도
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

  // 이번 주 요약 메시지 생성
  const wd = ['일','월','화','수','목','금','토'];
  const itemEvents = events.filter(ev => ev.items?.length > 0);
  
  let summaryText = `📋 이번 주 유치원 준비물 요약\n━━━━━━━━━━━━━━\n`;
  
  for (const ev of itemEvents) {
    const d = new Date(ev.date);
    const label = `${d.getMonth()+1}/${d.getDate()}(${wd[d.getDay()]})`;
    summaryText += `📅 ${label} ${ev.title}\n`;
    summaryText += `🎒 ${ev.items.join(', ')}\n\n`;
  }
  
  summaryText += `━━━━━━━━━━━━━━\n가정통신문 앱에서 자동 발송됨 🤖`;

  const wifeFriendUuid = await kvGet('kakao_wife_uuid');
  const results = [];

  // 나에게 보내기
  const myResult = await sendToMe(token, summaryText);
  results.push({ to: 'me', result: myResult });

  // 아내에게 보내기
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

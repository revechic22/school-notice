import { refreshKakaoToken, sendToMe, sendToFriend, buildNotifyText } from '../lib/kakao.js';

export default async function handler(req, res) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}` && 
    req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).end();
  }

  const today = toKSTDateString(new Date());
    const d1 = addDays(today, 1);
    const d2 = addDays(today, 2);

  const schedule = await kvGet('notify_schedule') || [];
    const targets = schedule.filter((ev) => ev.date === d1 || ev.date === d2);

  if (targets.length === 0) {
        return res.status(200).json({ message: '발송할 알림 없음', today });
  }

  let accessToken = await kvGet('kakao_access_token');
    const refreshToken = await kvGet('kakao_refresh_token');

  if (refreshToken) {
        const refreshed = await refreshKakaoToken(refreshToken);
        if (refreshed.access_token) {
                accessToken = refreshed.access_token;
                await kvSet('kakao_access_token', accessToken);
        }
        if (refreshed.refresh_token) {
                await kvSet('kakao_refresh_token', refreshed.refresh_token);
        }
  }

  if (!accessToken) {
        return res.status(500).json({ error: '카카오 토큰 없음. 앱에서 카카오 로그인 필요' });
  }

  const wifeFriendUuid = await kvGet('kakao_wife_uuid');
    const results = [];

  for (const ev of targets) {
        const daysLeft = ev.date === d1 ? 1 : 2;
        const text = buildNotifyText(ev, daysLeft);
        const myResult = await sendToMe(accessToken, text);
        results.push({ to: 'me', event: ev.title, result: myResult });
        if (wifeFriendUuid) {
                const wifeResult = await sendToFriend(accessToken, wifeFriendUuid, text);
                results.push({ to: 'wife', event: ev.title, result: wifeResult });
        }
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

function toKSTDateString(date) {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

// api/save-events.js
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { events, googleAccessToken } = req.body;
  if (!events?.length || !googleAccessToken) {
    return res.status(400).json({ error: 'events, googleAccessToken 필요' });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: googleAccessToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const savedIds = [];
  for (const ev of events) {
    try {
      const title = ev.items?.length
        ? `${ev.title} 🎒 ${ev.items.join(', ')}`
        : ev.title;

      const resource = {
        summary: title,
        description: [
          ev.description,
          ev.items?.length ? `준비물: ${ev.items.join(', ')}` : null,
        ].filter(Boolean).join('\n'),
        start: ev.time
          ? { dateTime: `${ev.date}T${ev.time}:00`, timeZone: 'Asia/Seoul' }
          : { date: ev.date },
        end: ev.time
          ? { dateTime: `${ev.date}T${ev.time}:00`, timeZone: 'Asia/Seoul' }
          : { date: ev.date },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 60 * 9 }],
        },
      };

      const created = await calendar.events.insert({ calendarId: 'primary', resource });
      savedIds.push(created.data.id);
    } catch (e) {
      console.error('캘린더 저장 실패:', e.message);
    }
  }

  const notifyTargets = events.filter((ev) => ev.items?.length > 0);
  if (notifyTargets.length > 0) {
    try {
      const existing = await kvGet('notify_schedule') || [];
      const merged = [...existing, ...notifyTargets];
      const deduped = merged.filter(
        (ev, i, arr) =>
          arr.findIndex((e) => e.date === ev.date && e.title === ev.title) === i
      );
      await kvSet('notify_schedule', deduped);
    } catch (e) {
      console.error('KV 저장 실패:', e.message);
    }
  }

  return res.status(200).json({ saved: savedIds.length, scheduled: notifyTargets.length });
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

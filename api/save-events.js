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
                                  overrides: ev.type === 'holiday' ? [] : [{ method: 'popup', minutes: 60 * 9 }],
                      },
            };

            const created = await calendar.events.insert({ calendarId: 'primary', resource });
                  savedIds.push(created.data.id);
          } catch (e) {
                  console.error('캘린더 저장 실패:', e.message);
          }
    }

  // 휴원일 포함 모든 일정을 notify_schedule에 저장 (D-2/D-1 알림용)
  const notifyTargets = events; // 휴원일도 포함
  let scheduled = 0;
    try {
          const existing = await kvGet('notify_schedule') || [];
          const merged = [...(Array.isArray(existing) ? existing : []), ...notifyTargets];
          const deduped = merged.filter(
                  (ev, i, arr) =>
                            arr.findIndex((e) => e.date === ev.date && e.title === ev.title) === i
                );
          await kvSet('notify_schedule', deduped);
          scheduled = notifyTargets.length;
    } catch (e) {
          console.error('KV 저장 실패:', e.message);
    }

  return res.status(200).json({ saved: savedIds.length, scheduled });
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

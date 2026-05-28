async function refreshKakaoToken(refreshToken) {
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KAKAO_REST_API_KEY,
      refresh_token: refreshToken,
    }),
  });
  return res.json();
}

async function sendToMe(accessToken, text) {
  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text,
        link: { web_url: '', mobile_web_url: '' },
      }),
    }),
  });
  return res.json();
}

async function sendToFriend(accessToken, friendUuid, text) {
  const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      receiver_uuids: JSON.stringify([friendUuid]),
      template_object: JSON.stringify({
        object_type: 'text',
        text,
        link: { web_url: '', mobile_web_url: '' },
      }),
    }),
  });
  return res.json();
}

function buildNotifyText(event, daysLeft) {
  const label = daysLeft === 1 ? '🔴 내일' : '🟡 모레';
  const items = event.items?.length
    ? '\n🎒 준비물: ' + event.items.join(', ')
    : '\n📌 준비물 없음';

  return (
    `${label} 유치원 준비 알림!\n` +
    `━━━━━━━━━━━━━━\n` +
    `📅 ${event.date} ${event.title}` +
    items +
    (event.description ? `\n📝 ${event.description}` : '') +
    `\n━━━━━━━━━━━━━━\n` +
    `가정통신문 앱에서 자동 발송됨 🤖`
  );
}

module.exports = { refreshKakaoToken, sendToMe, sendToFriend, buildNotifyText };

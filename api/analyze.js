export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, imageMimeType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 필요' });

  const prompt = `이 가정통신문 이미지를 분석해서 날짜별 일정과 준비물을 추출해주세요.
반드시 아래 형식의 순수 JSON만 반환하세요. 설명이나 마크다운 없이 JSON만요.

{
  "weekly_notices": ["불시 재난대피훈련 예정 - 양말 한 켤레 매일 지참"],
  "events": [
    {"date":"2026-05-26","title":"일정제목","description":"상세내용","items":["준비물1"],"time":null}
  ]
}

=== 반드시 따라야 할 규칙 ===

1. 제목(title): 절대 null 안됨. 일정명이 없으면 "등원" 으로 표시

2. 기간 준비물 ("다음 주 내내", "매일" 등):
   - 해당 주 등원일(월~금) 모두에 추가
   - 단, 휴원일(공휴일 등)은 제외

3. 특정 날짜 준비물:
   - 명시된 날짜에만 추가 (예: 26일 언어전달장 → 26일만)

4. 불시/예고없는 공지 ("불시", "예고없이" 등):
   - events가 아닌 weekly_notices 배열에 추가

5. 복장 = 준비물:
   - "복장", "입고 오세요", "복장 안내" 등으로 안내된 항목 전부 items에 추가
   - 예: "노란 티셔츠, 편한 바지, 운동화, 이름표" → 전부 items에 포함

6. 모래놀이 언급 시:
   - "모래놀이 신발" 자동 추가 (미기재여도)

7. 준비물 없는 날도 events에 포함 (items 빈 배열)

8. 날짜: YYYY-MM-DD 형식
9. time: 명시된 경우만 "HH:MM", 없으면 null`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: imageMimeType || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    console.log('Gemini 전체 응답:', JSON.stringify(data));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"events":[]}';
    console.log('Gemini 텍스트:', text);
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('분석 오류:', e.message);
    return res.status(500).json({ error: e.message, events: [] });
  }
}

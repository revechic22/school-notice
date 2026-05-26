export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 필요' });

  const prompt = `이 가정통신문 이미지를 분석해서 날짜별 일정과 준비물을 추출해주세요.
다음 JSON 형식만 반환하세요 (다른 텍스트 없이, 주석 없이):
{"events":[{"date":"2026-05-25","title":"일정제목","description":"상세내용","items":["준비물1"],"time":null}]}

=== 준비물 추출 규칙 ===
1. 기간 준비물: "다음 주 내내", "매일" 등 → 해당 주 등원일(월~금) 전체에 포함 (휴원일 제외)
2. 복장 안내 = 준비물: "복장", "입고 오세요" 등으로 안내된 항목 전부 items에 포함
3. 모래놀이 포함 시 → "모래놀이 신발" 자동 추가 (미기재여도)
4. 준비물 없는 날도 이벤트 포함 (items 빈 배열)
5. 날짜 YYYY-MM-DD, time은 명시된 경우만 "HH:MM" 아니면 null`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  return res.status(200).json(parsed);
}

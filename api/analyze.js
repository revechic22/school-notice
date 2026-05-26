export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 필요' });

  const prompt = `이 가정통신문 이미지를 분석해서 날짜별 일정과 준비물을 추출해주세요.
반드시 아래 JSON 형식만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환하세요.

{"events":[{"date":"2026-05-25","title":"일정제목","description":"상세내용","items":["준비물1"],"time":null}]}

준비물 추출 규칙:
1. 기간 준비물: "다음 주 내내", "매일" 등이면 해당 주 등원일 전체에 포함 (휴원일 제외)
2. 복장 안내 = 준비물: "복장", "입고 오세요" 등 항목 전부 items에 포함
3. 모래놀이 언급 시 "모래놀이 신발" 자동 추가
4. 준비물 없는 날도 포함 (items 빈 배열)
5. 날짜는 YYYY-MM-DD, time은 "HH:MM" 또는 null`;

  try {
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
          }],
          generationConfig: {
            response_mime_type: 'application/json'
          }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    console.log('Gemini 응답:', text);
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('분석 오류:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// 파일 위치: functions/[id].js

export async function onRequestGet(context) {
  // 1. URL에서 QR ID 추출 (예: qr-link.com/QR001 -> "QR001")
  const qrId = context.params.id;
  const env = context.env;

  // 2. Cloudflare 환경 변수에서 구글 시트 정보 가져오기
  const SHEET_ID = env.GOOGLE_SHEET_ID;
  const API_KEY = env.GOOGLE_SHEET_API_KEY;
  
  // 마스터 시트에서 읽어올 범위 (A열: QR ID, B열: 목적지 URL)
  const RANGE = "Sheet1!A:B"; 
  const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;

  try {
    // 3. 구글 시트에서 데이터 읽기 (0.1초 컷)
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.values) {
      // 시트 데이터에서 스캔된 QR ID와 일치하는 줄(Row) 찾기
      const row = data.values.find(r => r[0] === qrId);
      
      if (row && row[1]) {
        const destinationUrl = row[1]; // B열에 있는 고객의 실제 목적지 주소

        // -----------------------------------------------------------
        // ⭐️ [디럭스/프리미엄 옵션] 스캔 횟수 기록 (백그라운드 처리)
        // 화면 이동 속도에 영향을 주지 않도록 context.waitUntil() 사용
        // -----------------------------------------------------------
        if (env.TRACKING_WEBHOOK_URL) {
           const trackingUrl = `${env.TRACKING_WEBHOOK_URL}?id=${qrId}`;
           // 리다이렉트와 별개로 서버 뒷단에서 몰래 +1 카운트 명령을 보냄
           context.waitUntil(fetch(trackingUrl));
        }

        // 4. 즉시 목적지로 화면 이동 (302 임시 이동)
        return Response.redirect(destinationUrl, 302);
      }
    }
    
    // 시트에 ID가 없거나 주소 칸이 비어있는 경우
    return new Response("연결된 링크가 없거나 일시적으로 비활성화된 QR코드입니다.", { 
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
    
  } catch (error) {
    // 구글 API 장애 등 서버 문제 발생 시
    return new Response("서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", { 
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

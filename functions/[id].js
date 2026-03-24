export async function onRequestGet(context) {
  const qrId = context.params.id;
  const env = context.env;
  const request = context.request;

  // 1. 환경 변수에서 구글 시트 정보 가져오기
  const SHEET_ID = env.GOOGLE_SHEET_ID;
  const API_KEY = env.GOOGLE_SHEET_API_KEY;

  // 마스터 시트 범위 (A열: ID, B열: 목적지 URL, C열: 요금제 등급)
  // C열에 "Premium" 또는 "Deluxe"라고 적혀있는지 확인하기 위해 A:C를 읽습니다.
  const READ_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:C?key=${API_KEY}`;

  try {
    // 2. 구글 API로 마스터 시트 0.1초 만에 읽어오기
    const response = await fetch(READ_URL);
    const data = await response.json();

    if (data.values) {
      // 접속한 QR ID와 일치하는 행(Row) 찾기
      const row = data.values.find(r => r[0] === qrId);

      if (row && row[1]) {
        const destinationUrl = row[1];          // B열: 목적지 주소
        const planTier = row[2] || "Standard";  // C열: 요금제 (빈칸이면 기본 Standard로 인식)

        // -----------------------------------------------------------
        // ⭐️ [프리미엄 & 디럭스 전용 기능] 데이터 분석 및 백그라운드 기록
        // -----------------------------------------------------------
        if (planTier === "Premium" || planTier === "Deluxe") {
          
          // A. 접속 기기(OS) 판별 탐정 모드
          const userAgent = request.headers.get("User-Agent") || "";
          let device = "기타 (PC 등)";
          if (userAgent.includes("iPhone") || userAgent.includes("iPad")) device = "iOS (아이폰/아이패드)";
          else if (userAgent.includes("Android")) device = "Android (갤럭시 등)";
          else if (userAgent.includes("Mac OS")) device = "Mac (애플 PC)";
          else if (userAgent.includes("Windows")) device = "Windows (일반 PC)";

          // B. 접속 국가 판별 (Cloudflare 기본 제공 기능)
          const country = request.cf?.country || "알 수 없음";

          // C. 접속 시간 기록 (한국 시간 KST 기준)
          const now = new Date();
          const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
                          .toISOString().replace('T', ' ').substring(0, 19);

          // D. 기록할 데이터 패키징
          const logData = {
            id: qrId,
            time: kstTime,
            device: device,
            country: country,
            plan: planTier
          };

          // E. 백그라운드 기록 (화면 이동 속도에 영향 0%)
          // WEBHOOK_URL로 데이터를 몰래 쏴주고 서버는 퇴근합니다.
          if (env.WEBHOOK_URL) {
            const writeRequest = fetch(env.WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(logData)
            });
            context.waitUntil(writeRequest); // ⭐️ 속도 저하를 막는 핵심 마법!
          }
        }

        // 3. 사용자는 데이터가 기록되는지 모른 채 목적지로 즉시 튕겨 나감 (302 이동)
        return Response.redirect(destinationUrl, 302);
      }
    }

    // 시트에 등록되지 않은 잘못된 QR코드일 경우
    return new Response("연결된 링크가 없거나 일시적으로 비활성화된 QR코드입니다.", { 
      status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });

  } catch (error) {
    return new Response("서버 통신 중 오류가 발생했습니다.", { 
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

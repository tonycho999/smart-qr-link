export async function onRequestGet(context) {
  const qrId = context.params.id;
  const env = context.env;
  const request = context.request;

  // 1. 구글 시트 환경 변수 세팅
  const SHEET_ID = env.GOOGLE_SHEET_ID;
  const API_KEY = env.GOOGLE_SHEET_API_KEY;

  // 마스터 시트(Sheet1)에서 QR ID, 도착 URL, 요금제(Plan) 읽어오기
  const READ_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:C?key=${API_KEY}`;

  try {
    const response = await fetch(READ_URL);
    const data = await response.json();

    if (data.values) {
      // 접속한 QR ID와 일치하는 줄(Row) 찾기
      const row = data.values.find(r => r[0] === qrId);

      if (row && row[1]) {
        const destinationUrl = row[1];
        const planTier = row[2] || "Standard"; // 요금제 구분

        // -----------------------------------------------------------
        // ⭐️ [프리미엄 & 디럭스] 글로벌 & 정밀 분석 데이터 수집
        // -----------------------------------------------------------
        if (planTier === "Premium" || planTier === "Deluxe") {
          const userAgent = request.headers.get("User-Agent") || "";

          // A. 초정밀 기기 판별 (스마트폰 vs 태블릿 vs PC)
          let device = "기타 PC/기기";
          if (userAgent.includes("iPhone")) {
            device = "iPhone (스마트폰)";
          } else if (userAgent.includes("iPad")) {
            device = "iPad (태블릿)";
          } else if (userAgent.includes("Android")) {
            if (userAgent.includes("Mobile")) {
              device = "Android (스마트폰)";
            } else {
              device = "Android (태블릿)";
            }
          } else if (userAgent.includes("Macintosh") || userAgent.includes("Mac OS")) {
            device = "Mac (PC)";
          } else if (userAgent.includes("Windows")) {
            device = "Windows (PC)";
          }

          // B. 글로벌 인앱(In-App) 스캐너 및 브라우저 판별
          let browser = "기본/기타 브라우저";
          
          // --- [한국 & 일본 대표 메신저] ---
          if (userAgent.includes("KAKAOTALK")) {
            browser = "카카오톡 (인앱)";
          } else if (userAgent.includes("Line")) {
            browser = "LINE 라인 (인앱)";
          
          // --- [글로벌 메신저 (동남아, 미주, 유럽 등)] ---
          } else if (userAgent.includes("Telegram")) {
            browser = "텔레그램 (인앱)";
          } else if (userAgent.includes("WhatsApp")) {
            browser = "WhatsApp 왓츠앱 (인앱)";
          } else if (userAgent.includes("Viber")) {
            browser = "Viber 파이버 (인앱)";
          } else if (userAgent.includes("MicroMessenger")) {
            browser = "WeChat 위챗 (인앱)";
          
          // --- [글로벌 주요 SNS & 포털] ---
          } else if (userAgent.includes("Instagram")) {
            browser = "인스타그램 (인앱)";
          } else if (userAgent.includes("FBAV") || userAgent.includes("FBAN")) {
            browser = "페이스북 (인앱)";
          } else if (userAgent.includes("Twitter")) {
            browser = "X 트위터 (인앱)";
          } else if (userAgent.includes("TikTok") || userAgent.includes("trill")) {
            browser = "틱톡 TikTok (인앱)";
          } else if (userAgent.includes("NAVER")) {
            browser = "네이버 앱 (인앱)";
          
          // --- [일반 웹 브라우저] ---
          } else if (userAgent.includes("CriOS") || userAgent.includes("Chrome")) {
            browser = "Chrome 브라우저";
          } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
            browser = "Safari 브라우저";
          }

          // C. 접속 국가 판별 (Cloudflare 기능)
          const country = request.cf?.country || "알 수 없음";

          // D. 접속 시간 기록 (한국 시간 KST 기준)
          const now = new Date();
          const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
                          .toISOString().replace('T', ' ').substring(0, 19);

          // E. 구글 시트로 보낼 데이터 패키징 (browser 속성 추가됨)
          const logData = {
            id: qrId,
            time: kstTime,
            device: device,
            browser: browser,
            country: country,
            plan: planTier
          };

          // F. 속도 저하 없이 백그라운드에서 구글 시트(웹훅)에 기록 쏘기
          if (env.WEBHOOK_URL) {
            const writeRequest = fetch(env.WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(logData)
            });
            context.waitUntil(writeRequest); // 핵심! 사용자 화면 이동을 막지 않음
          }
        }

        // 사용자는 데이터 수집을 전혀 모른 채 0.1초 만에 목적지로 이동
        return Response.redirect(destinationUrl, 302);
      }
    }

    // 시트에 없거나 잘못된 QR코드일 경우
    return new Response("연결된 링크가 없거나 일시적으로 비활성화된 QR코드입니다.", { 
      status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });

  } catch (error) {
    return new Response("서버 통신 중 오류가 발생했습니다.", { 
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

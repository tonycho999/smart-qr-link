export async function onRequestGet(context) {
  const qrId = context.params.id;
  const env = context.env;
  const request = context.request;

  // 1. 구글 시트 환경 변수 세팅
  const SHEET_ID = env.GOOGLE_SHEET_ID;
  const API_KEY = env.GOOGLE_SHEET_API_KEY;

  const READ_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:C?key=${API_KEY}`;

  try {
    const response = await fetch(READ_URL);
    const data = await response.json();

    if (data.values) {
      const row = data.values.find(r => r[0] === qrId);

      if (row && row[1]) {
        const destinationUrl = row[1];
        const planTier = row[2] || "Standard"; 

        // -----------------------------------------------------------
        // ⭐️ [Premium & Deluxe] Global & Precision Analytics
        // -----------------------------------------------------------
        if (planTier === "Premium" || planTier === "Deluxe") {
          const userAgent = request.headers.get("User-Agent") || "";

          // A. 초정밀 기기 판별 (영문)
          let device = "Other Device";
          if (userAgent.includes("iPhone")) device = "iPhone (Mobile)";
          else if (userAgent.includes("iPad")) device = "iPad (Tablet)";
          else if (userAgent.includes("Android")) {
            device = userAgent.includes("Mobile") ? "Android (Mobile)" : "Android (Tablet)";
          } 
          else if (userAgent.includes("Macintosh") || userAgent.includes("Mac OS")) device = "Mac (Desktop)";
          else if (userAgent.includes("Windows")) device = "Windows (Desktop)";

          // B. 글로벌 인앱(In-App) 스캐너 및 브라우저 판별 (영문)
          let browser = "Default/Other Browser";
          if (userAgent.includes("KAKAOTALK")) browser = "KakaoTalk (In-App)";
          else if (userAgent.includes("Line")) browser = "LINE (In-App)";
          else if (userAgent.includes("Telegram")) browser = "Telegram (In-App)";
          else if (userAgent.includes("WhatsApp")) browser = "WhatsApp (In-App)";
          else if (userAgent.includes("Viber")) browser = "Viber (In-App)";
          else if (userAgent.includes("MicroMessenger")) browser = "WeChat (In-App)";
          else if (userAgent.includes("Instagram")) browser = "Instagram (In-App)";
          else if (userAgent.includes("FBAV") || userAgent.includes("FBAN")) browser = "Facebook (In-App)";
          else if (userAgent.includes("Twitter")) browser = "X / Twitter (In-App)";
          else if (userAgent.includes("TikTok") || userAgent.includes("trill")) browser = "TikTok (In-App)";
          else if (userAgent.includes("NAVER")) browser = "Naver (In-App)";
          else if (userAgent.includes("CriOS") || userAgent.includes("Chrome")) browser = "Chrome Browser";
          else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari Browser";

          // C. 접속 국가 판별
          const country = request.cf?.country || "Unknown";

          // D. ⭐️ [업그레이드] 접속자의 현지 시간 자동 판별
          const userTimezone = request.cf?.timezone || "UTC"; // 예: Asia/Seoul, America/New_York
          const now = new Date();
          let localTimeStr;
          
          try {
            // 접속자의 현지 타임존에 맞춰 YYYY-MM-DD HH:MM:SS 형태로 변환
            const formatter = new Intl.DateTimeFormat('en-CA', { 
              timeZone: userTimezone, 
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false 
            });
            // 시간 뒤에 타임존 이름까지 붙여서 신뢰도 상승!
            localTimeStr = formatter.format(now).replace(', ', ' ') + ` (${userTimezone})`;
          } catch (error) {
            // 실패 시 기본 UTC 시간 적용
            localTimeStr = now.toISOString().replace('T', ' ').substring(0, 19) + " (UTC)";
          }

          // E. 구글 시트로 보낼 데이터 패키징
          const logData = {
            id: qrId,
            time: localTimeStr, // 똑똑해진 현지 시간 투입!
            device: device,
            browser: browser,
            country: country,
            plan: planTier
          };

          // F. 백그라운드에서 구글 시트(웹훅)에 기록 쏘기
          if (env.WEBHOOK_URL) {
            const writeRequest = fetch(env.WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(logData)
            });
            context.waitUntil(writeRequest);
          }
        }

        return Response.redirect(destinationUrl, 302);
      }
    }

    // 영문 에러 안내
    return new Response("This QR Code is not yet activated or invalid. Please contact the administrator.", { 
      status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });

  } catch (error) {
    return new Response("Server communication error occurred.", { 
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

export async function onRequest(context) {
  // Cloudflare가 파악한 접속자의 국가 코드 (예: "KR", "US", "JP")
  // 만약 파악할 수 없다면 기본값으로 "US"를 지정
  const country = context.request.cf?.country || "US";

  // 판매 페이지 주소 세팅
  const kmongUrl = "https://kmong.com/gig/대표님크몽주소";
  const fiverrUrl = "https://www.fiverr.com/tonycho999/build-a-custom-qr-code-data-tracking-dashboard-in-google-sheets";

  // 접속 국가가 한국(KR)이면 크몽으로, 그 외의 모든 국가는 파이버로 리다이렉트
  if (country === "KR") {
    return Response.redirect(kmongUrl, 301);
  } else {
    return Response.redirect(fiverrUrl, 301);
  }
}

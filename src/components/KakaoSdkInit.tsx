"use client";

import Script from "next/script";

/**
 * 카카오톡 공유하기(Kakao.Share)용 SDK 로드 + 초기화.
 * onLoad 핸들러를 사용하므로 별도 클라이언트 컴포넌트로 분리
 * (layout.tsx는 서버 컴포넌트라 이벤트 핸들러를 props로 넘길 수 없음).
 */
export default function KakaoSdkInit() {
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
      integrity="sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4"
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (key && window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(key);
        }
      }}
    />
  );
}

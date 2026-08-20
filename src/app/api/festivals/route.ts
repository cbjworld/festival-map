import { NextResponse } from "next/server";
import { fetchFestivalsFromTourApi } from "@/lib/tourapi";

// 라우트 자체도 1시간 단위로 재검증 (fetch 캐시와 함께 이중 캐싱)
export const revalidate = 3600;

/**
 * GET /api/festivals
 * TourAPI searchFestival1 데이터를 조회해 앱 내부 포맷으로 반환한다.
 * 클라이언트(KakaoMap, page.tsx)는 이 라우트만 호출하며,
 * TourAPI 서비스 키는 서버에서만 사용되어 외부에 노출되지 않는다.
 */
export async function GET() {
  try {
    const festivals = await fetchFestivalsFromTourApi();
    return NextResponse.json(
      { festivals, count: festivals.length, fetchedAt: new Date().toISOString() },
      {
        headers: {
          // CDN/브라우저 캐시도 1시간 유지, 이후 백그라운드 재검증
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("[/api/festivals] TourAPI fetch failed:", error);
    return NextResponse.json(
      {
        festivals: [],
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "축제 정보를 불러오지 못했습니다.",
      },
      { status: 502 },
    );
  }
}

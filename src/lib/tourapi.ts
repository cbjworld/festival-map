import "server-only";
import type {
  Festival,
  FestivalStatus,
  RegionFilter,
  TourApiFestivalItem,
  TourApiResponse,
} from "@/types/festival";
import { AREA_CODE_TO_REGION, L_DONG_REGN_CD_TO_REGION } from "@/types/festival";

// NOTE: KorService2(신버전) 서비스는 오퍼레이션명도 "…2" 접미사를 쓴다.
// (KorService1 -> searchFestival1, KorService2 -> searchFestival2)
// 두 버전을 섞어 쓰면 NO_OPENAPI_SERVICE_ERROR(반환코드 12)가 발생한다.
const TOUR_API_BASE_URL =
  "https://apis.data.go.kr/B551011/KorService2/searchFestival2";

/** YYYYMMDD -> YYYY-MM-DD */
function formatDate(raw: string): string {
  if (!raw || raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** YYYYMMDD -> Date (자정 기준) */
function parseYyyymmdd(raw: string): Date | null {
  if (!raw || raw.length !== 8) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  return new Date(year, month - 1, day);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 오늘 날짜 기준 축제 상태 계산
 * - ongoing: 시작일 <= 오늘 <= 종료일
 * - upcoming: 오늘 < 시작일 <= 오늘 + 14일
 * - ended: 그 외 (이미 종료됐거나 14일보다 먼 미래)
 */
export function computeFestivalStatus(
  startRaw: string,
  endRaw: string,
): { status: FestivalStatus; dDay: number } {
  const today = startOfToday();
  const start = parseYyyymmdd(startRaw);
  const end = parseYyyymmdd(endRaw);

  if (!start || !end) {
    return { status: "ended", dDay: 9999 };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const dDay = Math.round((start.getTime() - today.getTime()) / msPerDay);

  if (start.getTime() <= today.getTime() && today.getTime() <= end.getTime()) {
    return { status: "ongoing", dDay };
  }

  if (dDay > 0 && dDay <= 14) {
    return { status: "upcoming", dDay };
  }

  return { status: "ended", dDay };
}

/**
 * 지역코드 -> 내부 RegionFilter 매핑 (알 수 없는 코드는 전국으로 처리)
 * KorService2 응답은 areacode가 비어있는 경우가 많아 lDongRegnCd(법정동 시/도 코드)를 우선 사용하고,
 * 없으면 구버전 areacode로 fallback한다.
 */
function resolveRegion(item: TourApiFestivalItem): RegionFilter {
  if (item.lDongRegnCd && L_DONG_REGN_CD_TO_REGION[item.lDongRegnCd]) {
    return L_DONG_REGN_CD_TO_REGION[item.lDongRegnCd];
  }
  if (item.areacode && AREA_CODE_TO_REGION[item.areacode]) {
    return AREA_CODE_TO_REGION[item.areacode];
  }
  return "all";
}

/**
 * 축제 설명을 바탕으로 짧은 한 줄 AI 요약을 만든다.
 * 실제 서비스에서는 LLM 호출로 대체 가능하며, 여기서는 보유 필드(주최자/장소/기간)를
 * 활용한 휴리스틱 요약을 생성해 API 비용 없이 동작하도록 구성했다.
 */
function buildAiSummary(item: TourApiFestivalItem): string {
  const place = item.addr1?.split(" ").slice(0, 2).join(" ") ?? "현지";
  const sponsor = item.sponsor1 ? `${item.sponsor1} 주최로 진행되며, ` : "";
  return `${sponsor}${place} 일대에서 열리는 지역 축제로, 방문 전 최신 프로그램 정보를 확인하는 것을 추천합니다.`;
}

/** TourAPI 원본 아이템 -> 앱 내부 Festival 타입 변환 */
export function transformFestivalItem(item: TourApiFestivalItem): Festival | null {
  const lat = Number(item.mapy);
  const lng = Number(item.mapx);

  // 좌표가 없는 데이터는 지도에 표시할 수 없으므로 제외
  if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  const { status, dDay } = computeFestivalStatus(
    item.eventstartdate,
    item.eventenddate,
  );

  return {
    id: item.contentid,
    title: item.title,
    addr: [item.addr1, item.addr2].filter(Boolean).join(" ").trim(),
    lat,
    lng,
    startDate: formatDate(item.eventstartdate),
    endDate: formatDate(item.eventenddate),
    image: item.firstimage || item.firstimage2 || null,
    tel: item.tel || null,
    sponsor: item.sponsor1 || null,
    areaCode: item.areacode,
    region: resolveRegion(item),
    status,
    dDay,
    aiSummary: buildAiSummary(item),
  };
}

interface FetchFestivalsOptions {
  numOfRows?: number;
  pageNo?: number;
  /** YYYYMMDD, 기본값: 오늘 - 30일 (진행중 축제 누락 방지) */
  eventStartDate?: string;
  areaCode?: string;
}

/**
 * TourAPI 4.0 searchFestival1 호출
 * - Next.js fetch 캐시를 이용해 1시간(3600초) 단위로 갱신
 * - 서비스 키는 .env의 TOUR_API_KEY 사용 (Decoding 키 권장)
 */
export async function fetchFestivalsFromTourApi(
  options: FetchFestivalsOptions = {},
): Promise<Festival[]> {
  // .env.local에 따옴표/공백/줄바꿈이 섞여 들어오는 경우를 방어적으로 제거
  const serviceKey = process.env.TOUR_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!serviceKey) {
    throw new Error(
      "TOUR_API_KEY 환경변수가 설정되어 있지 않습니다. .env.local을 확인하세요.",
    );
  }

  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const defaultEventStartDate = `${monthAgo.getFullYear()}${String(
    monthAgo.getMonth() + 1,
  ).padStart(2, "0")}${String(monthAgo.getDate()).padStart(2, "0")}`;

  const params = new URLSearchParams({
    serviceKey,
    MobileOS: "ETC",
    MobileApp: "전국축제지도",
    _type: "json",
    numOfRows: String(options.numOfRows ?? 500),
    pageNo: String(options.pageNo ?? 1),
    arrange: "A",
    eventStartDate: options.eventStartDate ?? defaultEventStartDate,
    ...(options.areaCode ? { areaCode: options.areaCode } : {}),
  });

  const requestUrl = `${TOUR_API_BASE_URL}?${params.toString()}`;

  const res = await fetch(requestUrl, {
    // 트래픽 절감을 위해 1시간 단위로 재검증 (ISR 스타일 캐싱)
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    // 실패 원인을 정확히 알기 위해 응답 본문까지 로그로 남긴다.
    const bodyText = await res.text().catch(() => "(본문을 읽을 수 없음)");
    console.error(
      `[tourapi] 요청 실패 - status: ${res.status} ${res.statusText}\n` +
        `요청 URL(키 마스킹): ${requestUrl.replace(serviceKey, `${serviceKey.slice(0, 4)}***${serviceKey.slice(-4)}`)}\n` +
        `응답 본문: ${bodyText}`,
    );
    throw new Error(
      `TourAPI 요청 실패: ${res.status} ${res.statusText} - ${bodyText.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as TourApiResponse<TourApiFestivalItem>;

  if (data.response.header.resultCode !== "0000") {
    throw new Error(`TourAPI 오류: ${data.response.header.resultMsg}`);
  }

  const rawItems = data.response.body.items.item;
  const items: TourApiFestivalItem[] = Array.isArray(rawItems)
    ? rawItems
    : rawItems
      ? [rawItems]
      : [];

  return items
    .map(transformFestivalItem)
    .filter((f): f is Festival => f !== null);
}
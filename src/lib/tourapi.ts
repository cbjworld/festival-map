import "server-only";
import type {
  Festival,
  FestivalStatus,
  RegionFilter,
  TourApiFestivalItem,
  TourApiResponse,
} from "@/types/festival";
import { AREA_CODE_TO_REGION, L_DONG_REGN_CD_TO_REGION } from "@/types/festival";
import festivalStandardData from "@/data/festivalStandardData.json";

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
 * - upcoming: 오늘 < 시작일 (며칠 뒤든 상관없이 아직 시작 전이면 전부 예정으로 처리)
 * - ended: 종료일이 이미 지난 경우
 *
 * 예전엔 "오늘+14일 이내"만 upcoming으로 치고 그보다 먼 미래 축제는 ended로 분류했었는데,
 * 그러면 몇 달 뒤 예정된 축제가 기본 화면(종료된 축제 숨김)에서 통째로 사라지는 문제가 있었다.
 * (예: 10월 축제인데 8월엔 "이미 종료된" 축제처럼 취급되어 안 보임)
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

  if (start.getTime() > today.getTime()) {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 주소 앞부분(시/도명) -> 내부 RegionFilter 매핑 (표준데이터셋용, areaCode가 없어 주소 문자열로 추정) */
const ADDRESS_PREFIX_TO_REGION: [string, RegionFilter][] = [
  ["서울", "seoul"],
  ["인천", "gyeonggi"],
  ["경기", "gyeonggi"],
  ["강원", "gangwon"],
  ["대전", "chungcheong"],
  ["세종", "chungcheong"],
  ["충청남도", "chungcheong"],
  ["충남", "chungcheong"],
  ["충청북도", "chungcheong"],
  ["충북", "chungcheong"],
  ["광주", "jeolla"],
  ["전라남도", "jeolla"],
  ["전남", "jeolla"],
  ["전라북도", "jeolla"],
  ["전북", "jeolla"],
  ["대구", "gyeongsang"],
  ["울산", "gyeongsang"],
  ["부산", "gyeongsang"],
  ["경상남도", "gyeongsang"],
  ["경남", "gyeongsang"],
  ["경상북도", "gyeongsang"],
  ["경북", "gyeongsang"],
  ["제주", "jeju"],
];

function resolveRegionFromAddress(addr: string): RegionFilter {
  const found = ADDRESS_PREFIX_TO_REGION.find(([prefix]) => addr.startsWith(prefix));
  return found ? found[1] : "all";
}

/** 공공데이터포털 "전국문화축제표준데이터" 스냅샷 원본 레코드 */
interface StandardFestivalRecord {
  축제명: string;
  개최장소: string;
  축제시작일자: string; // YYYY-MM-DD
  축제종료일자: string; // YYYY-MM-DD
  축제내용?: string;
  주관기관명?: string;
  주최기관명?: string;
  전화번호?: string;
  홈페이지주소?: string;
  소재지도로명주소?: string;
  소재지지번주소?: string;
  위도: string;
  경도: string;
}

/** 레코드 내용 기반으로 안정적인 고유 id를 만든다 (표준데이터셋엔 TourAPI 같은 contentId가 없다) */
function buildStandardFestivalId(record: StandardFestivalRecord): string {
  const raw = `${record.축제명}_${record.축제시작일자}_${record.위도}_${record.경도}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `std-${Math.abs(hash)}`;
}

function transformStandardRecord(record: StandardFestivalRecord): Festival | null {
  const lat = Number(record.위도);
  const lng = Number(record.경도);
  if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const startRaw = record.축제시작일자?.replace(/-/g, "");
  const endRaw = record.축제종료일자?.replace(/-/g, "");
  if (!startRaw || !endRaw) return null;

  const { status, dDay } = computeFestivalStatus(startRaw, endRaw);
  const addr = record.소재지도로명주소 || record.소재지지번주소 || record.개최장소 || "";
  const place = addr.split(" ").slice(0, 2).join(" ") || "현지";
  const sponsor = record.주최기관명 || record.주관기관명 || null;

  return {
    id: buildStandardFestivalId(record),
    title: record.축제명,
    addr,
    lat,
    lng,
    startDate: record.축제시작일자,
    endDate: record.축제종료일자,
    image: null,
    tel: record.전화번호 || null,
    sponsor,
    areaCode: "",
    region: resolveRegionFromAddress(addr),
    status,
    dDay,
    aiSummary: `${sponsor ? `${sponsor} 주최로 진행되며, ` : ""}${place} 일대에서 열리는 지역 축제로, 방문 전 최신 프로그램 정보를 확인하는 것을 추천합니다.`,
  };
}

/**
 * 공공데이터포털 "전국문화축제표준데이터"(지자체가 직접 등록) 스냅샷 파일로 축제를 보완한다.
 * TourAPI(searchFestival2)엔 아직 등록되지 않았거나 날짜가 갱신 안 된 축제를 지자체가
 * 먼저 등록해둔 경우가 있어, 제목이 겹치지 않는 것만 추가로 합친다.
 * - 실시간 API가 아니라 다운로드한 정적 스냅샷이라 자동으로 최신화되지 않는다.
 *   (최신 파일을 받으면 src/data/festivalStandardData.json을 교체하면 됨)
 */
function loadSupplementaryStandardFestivals(existingTitles: Set<string>): Festival[] {
  const records = (festivalStandardData as { records: StandardFestivalRecord[] }).records;
  const seenTitles = new Set(existingTitles);
  const results: Festival[] = [];

  for (const record of records) {
    const title = record.축제명?.trim();
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);

    const festival = transformStandardRecord(record);
    if (festival) results.push(festival);
  }

  return results;
}

interface FetchFestivalsOptions {
  numOfRows?: number;
  pageNo?: number;
  /** YYYYMMDD, 기본값: 오늘 - 30일 (진행중 축제 누락 방지) */
  eventStartDate?: string;
  areaCode?: string;
}

/** searchFestival2 한 페이지를 조회한다 */
async function fetchFestivalPage(
  serviceKey: string,
  params: URLSearchParams,
): Promise<{ items: TourApiFestivalItem[]; totalCount: number }> {
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

  return { items, totalCount: data.response.body.totalCount };
}

/**
 * TourAPI 4.0 searchFestival2 호출
 * - Next.js fetch 캐시를 이용해 1시간(3600초) 단위로 갱신
 * - 서비스 키는 .env의 TOUR_API_KEY 사용 (Decoding 키 권장)
 * - totalCount가 한 페이지(numOfRows)보다 많으면 나머지 페이지도 이어서 가져온다.
 *   (예전에는 1페이지만 가져와서, 축제 수가 많은 시기엔 뒷부분이 통째로 누락됐었다)
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

  const numOfRows = options.numOfRows ?? 1000;
  const eventStartDate = options.eventStartDate ?? defaultEventStartDate;
  // 페이지네이션이 무한 루프에 빠지지 않도록 안전 상한을 둔다 (numOfRows=1000 기준 최대 1만 건).
  const MAX_PAGES = 10;

  const buildParams = (pageNo: number) =>
    new URLSearchParams({
      serviceKey,
      MobileOS: "ETC",
      MobileApp: "전국축제지도",
      _type: "json",
      numOfRows: String(numOfRows),
      pageNo: String(pageNo),
      arrange: "A",
      eventStartDate,
      ...(options.areaCode ? { areaCode: options.areaCode } : {}),
    });

  const allItems: TourApiFestivalItem[] = [];
  let pageNo = options.pageNo ?? 1;
  let totalCount = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { items, totalCount: total } = await fetchFestivalPage(
      serviceKey,
      buildParams(pageNo),
    );
    allItems.push(...items);
    totalCount = total;

    const hasMore = allItems.length < totalCount && items.length > 0;
    if (!hasMore) break;

    pageNo += 1;
    // 다음 페이지 요청 전 살짝 쉬어서 초당 요청 제한을 피한다.
    await sleep(250);
  }

  console.log(
    `[tourapi] searchFestival2 조회 완료: totalCount=${totalCount}, ${allItems.length}건 수집`,
  );

  const primaryFestivals = allItems
    .map(transformFestivalItem)
    .filter((f): f is Festival => f !== null);

  // 표준데이터셋(정적 스냅샷)으로 보완: 네트워크 호출이 없어 빠르고 요청 제한 걱정도 없다.
  let supplementaryFestivals: Festival[] = [];
  try {
    const existingTitles = new Set(primaryFestivals.map((f) => f.title.trim()));
    supplementaryFestivals = loadSupplementaryStandardFestivals(existingTitles);
    console.log(
      `[tourapi] 표준데이터셋 보완: ${supplementaryFestivals.length}건 추가 ` +
        `(searchFestival2 ${primaryFestivals.length}건 + 표준데이터셋 보완)`,
    );
  } catch (error) {
    console.error("[tourapi] 표준데이터셋 보완 실패:", error);
  }

  return [...primaryFestivals, ...supplementaryFestivals];
}

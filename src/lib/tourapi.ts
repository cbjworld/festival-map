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

// 지역기반 관광정보조회(areaBasedList2) - searchFestival2가 놓치는 축제(행사 기간이
// 등록되지 않았거나 검색 기간 밖인 경우 등)를 보완하기 위해 추가로 조회한다.
// contentTypeId=15 는 "축제/공연/행사" 카테고리를 의미한다.
const AREA_BASED_LIST_URL =
  "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";
// 행사 시작/종료일은 areaBasedList2 응답에 없어서, 상세 소개(detailIntro2)를 한 번 더 호출해 채운다.
const DETAIL_INTRO_URL =
  "https://apis.data.go.kr/B551011/KorService2/detailIntro2";
const FESTIVAL_CONTENT_TYPE_ID = "15";

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

/** areaBasedList2 원본 응답 아이템 (행사 시작/종료일 필드가 없다) */
interface TourApiAreaBasedItem {
  addr1: string;
  addr2?: string;
  areacode: string;
  sigungucode?: string;
  lDongRegnCd?: string;
  lDongSignguCd?: string;
  contentid: string;
  contenttypeid: string;
  firstimage?: string;
  firstimage2?: string;
  mapx: string;
  mapy: string;
  tel?: string;
  title: string;
}

/** detailIntro2 응답 중 축제(contentTypeId=15)에서 쓰는 필드만 발췌 */
interface TourApiFestivalIntroItem {
  eventstartdate?: string;
  eventenddate?: string;
  sponsor1?: string;
}

function buildCommonParams(serviceKey: string): Record<string, string> {
  return {
    serviceKey,
    MobileOS: "ETC",
    MobileApp: "전국축제지도",
    _type: "json",
  };
}

/**
 * areaBasedList2로 축제(contentTypeId=15) 목록을 조회한다.
 * searchFestival2와 달리 기간 파라미터가 없어, 등록된 축제 전체가 대상이 된다.
 */
async function fetchAreaBasedFestivalItems(
  serviceKey: string,
): Promise<TourApiAreaBasedItem[]> {
  const params = new URLSearchParams({
    ...buildCommonParams(serviceKey),
    numOfRows: "1000",
    pageNo: "1",
    arrange: "C",
    contentTypeId: FESTIVAL_CONTENT_TYPE_ID,
  });

  const requestUrl = `${AREA_BASED_LIST_URL}?${params.toString()}`;
  const res = await fetch(requestUrl, { next: { revalidate: 3600 } });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "(본문을 읽을 수 없음)");
    console.error(
      `[tourapi] areaBasedList2 요청 실패 - status: ${res.status} ${res.statusText}\n응답 본문: ${bodyText}`,
    );
    return [];
  }

  const data = (await res.json()) as TourApiResponse<TourApiAreaBasedItem>;
  if (data.response.header.resultCode !== "0000") {
    console.error(`[tourapi] areaBasedList2 오류: ${data.response.header.resultMsg}`);
    return [];
  }

  const rawItems = data.response.body.items.item;
  return Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
}

// 원인 파악을 위해 detailIntro2 실패/이상 응답 로그를 앞의 몇 건만 자세히 남긴다.
let debugLogCount = 0;
const MAX_DEBUG_LOGS = 5;

/** detailIntro2로 특정 축제(contentId)의 행사 시작/종료일을 조회한다 */
async function fetchFestivalEventDates(
  serviceKey: string,
  contentId: string,
): Promise<TourApiFestivalIntroItem | null> {
  const params = new URLSearchParams({
    ...buildCommonParams(serviceKey),
    contentId,
    contentTypeId: FESTIVAL_CONTENT_TYPE_ID,
  });

  const requestUrl = `${DETAIL_INTRO_URL}?${params.toString()}`;

  // TourAPI는 "초당 요청 제한"이 있어(LIMITED_NUMBER_OF_SERVICE_REQUESTS_PER_SECOND_EXCEEDS_ERROR,
  // HTTP 429) 짧은 시간에 몰아서 호출하면 실패한다. 429를 받으면 잠깐 쉬었다가 최대 2번 더 재시도한다.
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(requestUrl, { next: { revalidate: 3600 } });

      if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        if (debugLogCount < MAX_DEBUG_LOGS) {
          debugLogCount++;
          console.error(
            `[tourapi] detailIntro2 재시도 초과 (contentId: ${contentId}) - 초당 요청 제한 지속`,
          );
        }
        return null;
      }

      if (!res.ok) {
        if (debugLogCount < MAX_DEBUG_LOGS) {
          debugLogCount++;
          const bodyText = await res.text().catch(() => "(본문을 읽을 수 없음)");
          console.error(
            `[tourapi] detailIntro2 응답 실패 (contentId: ${contentId}) - status: ${res.status}\n응답 본문: ${bodyText}`,
          );
        }
        return null;
      }

      const data = (await res.json()) as TourApiResponse<TourApiFestivalIntroItem>;
      if (data.response.header.resultCode !== "0000") {
        if (debugLogCount < MAX_DEBUG_LOGS) {
          debugLogCount++;
          console.error(
            `[tourapi] detailIntro2 오류 (contentId: ${contentId}): ` +
              `${data.response.header.resultCode} - ${data.response.header.resultMsg}`,
          );
        }
        return null;
      }

      const rawItems = data.response.body.items.item;
      const item = Array.isArray(rawItems) ? rawItems[0] : rawItems || null;
      return item || null;
    } catch (error) {
      if (debugLogCount < MAX_DEBUG_LOGS) {
        debugLogCount++;
        console.error(`[tourapi] detailIntro2 요청 실패 (contentId: ${contentId}):`, error);
      }
      return null;
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * searchFestival2 결과에 없는 축제를 areaBasedList2로 보완해 가져온다.
 * (행사 기간이 검색 기간 밖이거나 미등록이라 searchFestival2에서 누락된 경우 대비)
 * 상세 호출(detailIntro2)이 추가로 발생하므로, 이미 갖고 있는 id는 건너뛴다.
 */
async function fetchSupplementaryFestivals(
  serviceKey: string,
  existingIds: Set<string>,
): Promise<Festival[]> {
  debugLogCount = 0;
  const areaItems = await fetchAreaBasedFestivalItems(serviceKey);
  const missingItems = areaItems.filter((item) => !existingIds.has(item.contentid));

  console.log(
    `[tourapi] areaBasedList2 보완 조회: 전체 ${areaItems.length}건 중 ` +
      `searchFestival2에 없는 ${missingItems.length}건 발견 (기존 ${existingIds.size}건)`,
  );

  if (missingItems.length === 0) return [];

  // detailIntro2는 초당 요청 제한이 매우 엄격해서(동시 3개도 걸림) 순차 호출 + 넉넉한 간격이 필요하다.
  // searchFestival2 쪽을 페이지네이션으로 보강한 뒤라서, 여기는 소수의 예외 케이스만 처리하면 된다.
  const CONCURRENCY = 1;
  const BATCH_DELAY_MS = 1100;
  // 서버리스 요청 시간 제한(및 사용자 체감 속도)을 고려해 한 번에 처리할 시간 예산을 둔다.
  // 예산을 넘기면 남은 건은 건너뛰고, 이미 성공한 항목(fetch 캐시)은 다음 재검증(1시간) 때
  // 즉시 캐시로 응답되므로 시간이 새 항목 쪽으로 자연히 배분되어 점점 더 많이 채워진다.
  const TIME_BUDGET_MS = 8000;
  const startedAt = Date.now();

  const results: Festival[] = [];
  let skippedByBudget = 0;

  for (let i = 0; i < missingItems.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      skippedByBudget = missingItems.length - i;
      break;
    }

    const batch = missingItems.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const intro = await fetchFestivalEventDates(serviceKey, item.contentid);
        if (!intro?.eventstartdate || !intro?.eventenddate) return null;

        const fullItem: TourApiFestivalItem = {
          ...item,
          cat1: "",
          cat2: "",
          cat3: "",
          contenttypeid: FESTIVAL_CONTENT_TYPE_ID,
          createdtime: "",
          eventstartdate: intro.eventstartdate,
          eventenddate: intro.eventenddate,
          modifiedtime: "",
          sponsor1: intro.sponsor1,
        };
        return transformFestivalItem(fullItem);
      }),
    );
    results.push(...batchResults.filter((f): f is Festival => f !== null));

    if (i + CONCURRENCY < missingItems.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `[tourapi] areaBasedList2 보완 조회 완료: ${missingItems.length}건 중 ` +
      `기간 정보 확인 후 ${results.length}건 최종 추가` +
      (skippedByBudget > 0 ? ` (시간 예산 초과로 ${skippedByBudget}건은 이번 조회에서 건너뜀)` : ""),
  );

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

  // areaBasedList2 보완 조회는 기본적으로 꺼둔다.
  // detailIntro2가 매우 엄격한 초당 요청 제한에 걸려(순차 호출 + 1.1초 간격에도 재시도까지 실패),
  // 매 요청마다 8~10초를 그냥 날리면서도 실제로는 0건 추가되는 상태였다.
  // 필요하면 ENABLE_AREA_BASED_SUPPLEMENT=true 환경변수로 다시 켤 수 있다.
  const supplementEnabled = process.env.ENABLE_AREA_BASED_SUPPLEMENT === "true";
  let supplementaryFestivals: Festival[] = [];
  if (supplementEnabled) {
    try {
      const existingIds = new Set(primaryFestivals.map((f) => f.id));
      supplementaryFestivals = await fetchSupplementaryFestivals(serviceKey, existingIds);
    } catch (error) {
      console.error("[tourapi] areaBasedList2 보완 조회 실패:", error);
    }
  }

  return [...primaryFestivals, ...supplementaryFestivals];
}

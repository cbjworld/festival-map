/**
 * TourAPI 4.0 - 국문 관광정보 서비스
 * searchFestival1 (행사/공연/축제 정보 조회) 관련 타입 정의
 *
 * 공식 문서: https://api.visitkorea.or.kr (한국관광공사 TourAPI 4.0)
 */

/** TourAPI 공통 응답 래퍼 */
export interface TourApiResponse<T> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: T[] | T | "";
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/**
 * searchFestival1 원본 응답 아이템
 * (TourAPI 4.0 문서 기준 필드명, 실제 응답은 항상 string)
 */
export interface TourApiFestivalItem {
  addr1: string; // 주소
  addr2?: string; // 상세주소
  areacode: string; // 지역코드 (구버전 필드, KorService2에서는 비어있는 경우가 많음)
  sigungucode?: string; // 시군구코드 (구버전 필드)
  lDongRegnCd?: string; // 법정동 기준 시/도 코드 (KorService2, areacode 대체)
  lDongSignguCd?: string; // 법정동 기준 시군구 코드 (KorService2, sigungucode 대체)
  cat1: string;
  cat2: string;
  cat3: string;
  contentid: string; // 콘텐츠ID (고유값)
  contenttypeid: string; // 콘텐츠타입ID (15: 축제/공연/행사)
  createdtime: string;
  eventstartdate: string; // 축제 시작일 YYYYMMDD
  eventenddate: string; // 축제 종료일 YYYYMMDD
  firstimage?: string; // 대표이미지 (원본)
  firstimage2?: string; // 대표이미지 (썸네일)
  cpyrhtDivCd?: string;
  mapx: string; // 경도 (GPS X)
  mapy: string; // 위도 (GPS Y)
  mlevel?: string;
  modifiedtime: string;
  programs?: string;
  sponsor1?: string; // 주최자 정보
  sponsor1tel?: string;
  sponsor2?: string;
  sponsor2tel?: string;
  tel?: string; // 전화번호
  title: string; // 축제명
  zipcode?: string;
}

/** 축제 진행 상태 */
export type FestivalStatus = "ongoing" | "upcoming" | "ended";

/** 지역 필터 코드 (TourAPI areacode 기준 대분류로 그룹핑) */
export type RegionFilter =
  | "all"
  | "seoul"
  | "gyeonggi"
  | "gangwon"
  | "chungcheong"
  | "jeolla"
  | "gyeongsang"
  | "jeju";

/** 상태 필터 옵션 */
export type StatusFilter = "all" | "ongoing" | "thisWeek";

/**
 * 앱 내부에서 사용하는 정규화된 축제 객체
 * (tourapi.ts의 변환 함수가 TourApiFestivalItem -> Festival 로 매핑)
 */
export interface Festival {
  id: string; // contentid
  title: string;
  addr: string; // addr1 + addr2 결합
  lat: number; // mapy
  lng: number; // mapx
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  image: string | null; // firstimage
  tel: string | null;
  sponsor: string | null;
  areaCode: string;
  region: RegionFilter;
  status: FestivalStatus;
  dDay: number; // 시작일까지 D-Day (음수면 이미 시작함, 0이면 오늘 시작)
  aiSummary: string; // AI 1줄 요약 (더미/생성 텍스트)
}

/**
 * 법정동 기준 시/도 코드(lDongRegnCd, 2자리) -> RegionFilter 매핑 테이블
 * KorService2(searchFestival2) 응답은 구버전 areacode 대신 lDongRegnCd를 채워준다.
 * (2023년 강원/전북 특별자치도 전환 이후 코드 기준)
 */
export const L_DONG_REGN_CD_TO_REGION: Record<string, RegionFilter> = {
  "11": "seoul", // 서울
  "26": "gyeongsang", // 부산
  "27": "gyeongsang", // 대구
  "28": "gyeonggi", // 인천(수도권으로 그룹핑)
  "29": "jeolla", // 광주
  "30": "chungcheong", // 대전
  "31": "gyeongsang", // 울산
  "36": "chungcheong", // 세종
  "41": "gyeonggi", // 경기
  "51": "gangwon", // 강원특별자치도
  "43": "chungcheong", // 충북
  "44": "chungcheong", // 충남
  "45": "jeolla", // 전북
  "52": "jeolla", // 전북특별자치도
  "46": "jeolla", // 전남
  "47": "gyeongsang", // 경북
  "48": "gyeongsang", // 경남
  "50": "jeju", // 제주
};

/** 구버전 지역코드(areacode) -> RegionFilter 매핑 테이블 (lDongRegnCd가 없을 때 fallback) */
export const AREA_CODE_TO_REGION: Record<string, RegionFilter> = {
  "1": "seoul", // 서울
  "31": "gyeonggi", // 경기
  "32": "gangwon", // 강원(영월/강원특별자치도)
  "33": "chungcheong", // 충북
  "34": "chungcheong", // 대전/충남
  "35": "chungcheong", // 충남
  "36": "chungcheong", // 세종(충청권으로 그룹핑)
  "37": "jeolla", // 전북
  "38": "jeolla", // 전남/광주
  "39": "jeju", // 제주
  "4": "gyeonggi", // 인천(수도권)
  "5": "chungcheong", // 대전
  "6": "gyeongsang", // 대구
  "7": "gyeongsang", // 울산
  "8": "gyeongsang", // 부산
};

export const REGION_LABELS: Record<RegionFilter, string> = {
  all: "전국",
  seoul: "서울",
  gyeonggi: "경기",
  gangwon: "강원",
  chungcheong: "충청",
  jeolla: "전라",
  gyeongsang: "경상",
  jeju: "제주",
};

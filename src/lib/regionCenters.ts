import type { RegionFilter } from "@/types/festival";

/** 지역 선택 시 지도가 이동할 대략적인 중심 좌표 & 확대 레벨 */
export const REGION_CENTERS: Record<
  Exclude<RegionFilter, "all">,
  { lat: number; lng: number; level: number }
> = {
  seoul: { lat: 37.5665, lng: 126.978, level: 8 },
  gyeonggi: { lat: 37.4138, lng: 127.5183, level: 10 },
  gangwon: { lat: 37.8228, lng: 128.1555, level: 10 },
  chungcheong: { lat: 36.6357, lng: 127.4917, level: 10 },
  jeolla: { lat: 35.32, lng: 126.889, level: 10 },
  gyeongsang: { lat: 35.8714, lng: 128.6014, level: 10 },
  jeju: { lat: 33.4996, lng: 126.5312, level: 10 },
};

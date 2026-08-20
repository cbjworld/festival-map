"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { Festival } from "@/types/festival";

const KOREA_CENTER = { lat: 36.2, lng: 127.8 };
const DEFAULT_LEVEL = 13;

/** 부모 컴포넌트에서 지도를 직접 제어할 수 있도록 넘겨주는 명령 함수 모음 */
export interface KakaoMapControls {
  /** 특정 좌표로 지도 중심 이동 (level을 주면 확대/축소도 함께) */
  panTo: (lat: number, lng: number, level?: number) => void;
}

interface KakaoMapProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (festival: Festival) => void;
  /** 리스트에서 커서를 올린 축제 - 지도의 해당 마커를 강조 표시 */
  hoveredFestivalId?: string | null;
  /** 사용자 현재 위치 (있으면 초기 중심으로 사용 + 위치 마커 표시) */
  userLocation?: { lat: number; lng: number } | null;
  /** 마커가 아닌 지도의 빈 영역을 클릭했을 때 (상세 카드 닫기 등에 사용) */
  onMapClick?: () => void;
  /** 지도가 준비되면 제어 함수(panTo 등)를 한 번 전달 */
  onReady?: (controls: KakaoMapControls) => void;
}

/** 상태별 마커 색상 */
const STATUS_COLOR: Record<Festival["status"], string> = {
  ongoing: "#22C55E",
  upcoming: "#EAB308",
  ended: "#9CA3AF",
};

/** 사용자 현재 위치 마커 색상 (Apple Maps 느낌의 시스템 블루) */
const USER_LOCATION_COLOR = "#007AFF";

/**
 * 마커(CustomOverlay)에 들어갈 HTML 문자열을 생성한다.
 * - ongoing 상태는 pulse 애니메이션(아우라)이 붙은 마커
 * - selected 상태는 크게 확대 + 흰색/상태색 테두리 강조
 * - hovered 상태(리스트에서 커서를 올린 경우)는 살짝 확대 + 파란 테두리로 은은하게 강조
 */
function buildMarkerHtml(
  festival: Festival,
  isSelected: boolean,
  isHovered = false,
): string {
  const color = STATUS_COLOR[festival.status];
  const scale = isSelected ? 1.25 : isHovered ? 1.15 : 1;
  const pulse =
    festival.status === "ongoing"
      ? `<span class="festival-marker-pulse" style="background:${color};"></span>`
      : "";

  let ring = "0 2px 6px rgba(0,0,0,0.35)";
  if (isSelected) {
    ring = "0 0 0 3px rgba(255,255,255,0.9), 0 0 0 5px " + color;
  } else if (isHovered) {
    ring = "0 0 0 3px rgba(255,255,255,0.9), 0 0 0 5px rgba(0,122,255,0.65)";
  }

  return `
    <div class="festival-marker-wrap" style="transform: scale(${scale});">
      ${pulse}
      <div class="festival-marker-dot" style="background:${color}; box-shadow:${ring};"></div>
    </div>
  `;
}

/** 사용자 현재 위치 마커(파란 점 + 아우라) HTML */
function buildUserLocationMarkerHtml(): string {
  return `
    <div class="festival-marker-wrap">
      <span class="festival-marker-pulse" style="background:${USER_LOCATION_COLOR};"></span>
      <div class="festival-marker-dot" style="background:${USER_LOCATION_COLOR}; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
    </div>
  `;
}

/** 마커 애니메이션 등에 쓰이는 전역 스타일을 최초 1회 주입 */
function injectMarkerStylesOnce() {
  const id = "festival-marker-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .festival-marker-wrap {
      position: relative;
      width: 22px;
      height: 22px;
      cursor: pointer;
      transition: transform 0.15s ease-out;
    }
    .festival-marker-dot {
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      border: 2px solid white;
    }
    .festival-marker-pulse {
      position: absolute;
      inset: -6px;
      border-radius: 9999px;
      opacity: 0.55;
      animation: festival-pulse 1.8s ease-out infinite;
    }
    @keyframes festival-pulse {
      0% { transform: scale(0.6); opacity: 0.55; }
      70% { transform: scale(1.9); opacity: 0; }
      100% { transform: scale(1.9); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export default function KakaoMap({
  festivals,
  selectedFestivalId,
  onSelectFestival,
  hoveredFestivalId,
  userLocation,
  onMapClick,
  onReady,
}: KakaoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const overlaysRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());
  const userLocationOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? "";

  // 지도 최초 생성
  useEffect(() => {
    if (!isSdkLoaded || !mapContainerRef.current || mapRef.current) return;

    window.kakao.maps.load(() => {
      const center = new window.kakao.maps.LatLng(
        userLocation?.lat ?? KOREA_CENTER.lat,
        userLocation?.lng ?? KOREA_CENTER.lng,
      );

      const map = new window.kakao.maps.Map(mapContainerRef.current!, {
        center,
        level: userLocation ? 7 : DEFAULT_LEVEL,
      });

      mapRef.current = map;
      injectMarkerStylesOnce();

      // 마커가 아닌 지도 빈 공간을 클릭하면 상세 카드를 닫을 수 있도록 알림
      window.kakao.maps.event.addListener(map, "click", () => {
        onMapClick?.();
      });

      setIsMapReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSdkLoaded]);

  // 지도가 준비되면 부모에게 제어 함수(panTo)를 한 번 전달
  useEffect(() => {
    if (!isMapReady) return;
    onReady?.({
      panTo: (lat, lng, level) => {
        if (!mapRef.current) return;
        mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng));
        if (level) mapRef.current.setLevel(level);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapReady]);

  // 사용자 위치가 확인되면 중심 이동 + 위치 마커 표시/갱신
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !userLocation) return;
    const latlng = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);

    if (userLocationOverlayRef.current) {
      userLocationOverlayRef.current.setPosition(latlng);
    } else {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildUserLocationMarkerHtml();
      userLocationOverlayRef.current = new window.kakao.maps.CustomOverlay({
        position: latlng,
        content: wrapper,
        map: mapRef.current,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 20,
      });
    }

    mapRef.current.panTo(latlng);
    mapRef.current.setLevel(7);
  }, [isMapReady, userLocation]);

  // 축제 목록이 바뀔 때마다 마커(CustomOverlay) 동기화
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const map = mapRef.current;
    const currentIds = new Set(festivals.map((f) => f.id));

    // 사라진 마커 제거
    overlaysRef.current.forEach((overlay, id) => {
      if (!currentIds.has(id)) {
        overlay.setMap(null);
        overlaysRef.current.delete(id);
      }
    });

    // 신규/갱신 마커 반영 (기존 마커는 제거 후 재생성하여 최신 상태 반영)
    festivals.forEach((festival) => {
      const isSelected = festival.id === selectedFestivalId;
      const isHovered = festival.id === hoveredFestivalId;
      const existing = overlaysRef.current.get(festival.id);
      if (existing) {
        existing.setMap(null);
        overlaysRef.current.delete(festival.id);
      }

      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildMarkerHtml(festival, isSelected, isHovered);
      wrapper.style.zIndex = isSelected ? "10" : isHovered ? "5" : "1";
      wrapper.addEventListener("click", (e) => {
        // 지도 클릭 이벤트(빈 공간 클릭 = 카드 닫기)로 전파되지 않도록 차단
        e.stopPropagation();
        onSelectFestival(festival);
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(festival.lat, festival.lng),
        content: wrapper,
        map,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isSelected ? 10 : 1,
        clickable: true,
      });

      overlaysRef.current.set(festival.id, overlay);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festivals, isMapReady]);

  // 선택/호버된 마커가 바뀔 때, 영향받는 마커(이전 값 + 새 값)만 다시 그려 강조 표시
  const prevSelectedRef = useRef<string | null>(null);
  const prevHoveredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const map = mapRef.current;

    const idsToRefresh = new Set<string>();
    if (prevSelectedRef.current) idsToRefresh.add(prevSelectedRef.current);
    if (selectedFestivalId) idsToRefresh.add(selectedFestivalId);
    if (prevHoveredRef.current) idsToRefresh.add(prevHoveredRef.current);
    if (hoveredFestivalId) idsToRefresh.add(hoveredFestivalId);

    idsToRefresh.forEach((id) => {
      const overlay = overlaysRef.current.get(id);
      const festival = festivals.find((f) => f.id === id);
      if (!overlay || !festival) return;

      const isSelected = id === selectedFestivalId;
      const isHovered = id === hoveredFestivalId;

      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildMarkerHtml(festival, isSelected, isHovered);
      wrapper.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectFestival(festival);
      });
      // CustomOverlay는 content 교체를 위해 재생성이 가장 안전하다.
      overlay.setMap(null);
      const newOverlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(festival.lat, festival.lng),
        content: wrapper,
        map,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isSelected ? 10 : isHovered ? 5 : 1,
        clickable: true,
      });
      overlaysRef.current.set(id, newOverlay);
    });

    prevSelectedRef.current = selectedFestivalId;
    prevHoveredRef.current = hoveredFestivalId ?? null;
    // festivals 자체 변경은 위쪽 전체 동기화 effect에서 처리하므로 의도적으로 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFestivalId, hoveredFestivalId, isMapReady]);

  // 선택된 축제로 지도 중심 이동
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !selectedFestivalId) return;
    const festival = festivals.find((f) => f.id === selectedFestivalId);
    if (!festival) return;
    mapRef.current.panTo(new window.kakao.maps.LatLng(festival.lat, festival.lng));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFestivalId, isMapReady]);

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoAppKey}&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => setIsSdkLoaded(true)}
      />
      <div ref={mapContainerRef} className="h-full w-full" />
      {!kakaoAppKey && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 p-6 text-center text-sm text-gray-500">
          NEXT_PUBLIC_KAKAO_MAP_APP_KEY 환경변수가 설정되지 않았습니다.
          <br />
          카카오 개발자 콘솔에서 발급받은 JavaScript 키를 .env.local에 등록해주세요.
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { Festival } from "@/types/festival";

const KOREA_CENTER = { lat: 36.2, lng: 127.8 };
const DEFAULT_LEVEL = 13;

interface KakaoMapProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (festival: Festival) => void;
  /** 사용자 현재 위치 (있으면 초기 중심으로 사용) */
  userLocation?: { lat: number; lng: number } | null;
}

/** 상태별 마커 색상 */
const STATUS_COLOR: Record<Festival["status"], string> = {
  ongoing: "#22C55E",
  upcoming: "#EAB308",
  ended: "#9CA3AF",
};

/**
 * 마커(CustomOverlay)에 들어갈 HTML 문자열을 생성한다.
 * - ongoing 상태는 pulse 애니메이션(아우라)이 붙은 마커
 * - selected 상태는 살짝 확대 + 테두리 강조
 */
function buildMarkerHtml(festival: Festival, isSelected: boolean): string {
  const color = STATUS_COLOR[festival.status];
  const scale = isSelected ? 1.25 : 1;
  const pulse =
    festival.status === "ongoing"
      ? `<span class="festival-marker-pulse" style="background:${color};"></span>`
      : "";

  const ring = isSelected ? "0 0 0 3px rgba(255,255,255,0.9), 0 0 0 5px " + color : "0 2px 6px rgba(0,0,0,0.35)";

  return `
    <div class="festival-marker-wrap" style="transform: scale(${scale});">
      ${pulse}
      <div class="festival-marker-dot" style="background:${color}; box-shadow:${ring};"></div>
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
  userLocation,
}: KakaoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const overlaysRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());
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
      setIsMapReady(true);
    });
  }, [isSdkLoaded, userLocation]);

  // 사용자 위치가 뒤늦게 확인되면 중심 이동
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !userLocation) return;
    const latlng = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);
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
      const existing = overlaysRef.current.get(festival.id);
      if (existing) {
        existing.setMap(null);
        overlaysRef.current.delete(festival.id);
      }

      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildMarkerHtml(festival, isSelected);
      wrapper.style.zIndex = isSelected ? "10" : "1";
      wrapper.addEventListener("click", () => onSelectFestival(festival));

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

  // 선택된 마커가 바뀌면 해당 마커만 다시 그려 강조 표시
  useEffect(() => {
    if (!isMapReady) return;
    overlaysRef.current.forEach((overlay, id) => {
      const festival = festivals.find((f) => f.id === id);
      if (!festival) return;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildMarkerHtml(festival, id === selectedFestivalId);
      wrapper.addEventListener("click", () => onSelectFestival(festival));
      // CustomOverlay는 content 교체를 위해 재생성이 가장 안전하다.
      overlay.setMap(null);
      const newOverlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(festival.lat, festival.lng),
        content: wrapper,
        map: mapRef.current!,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: id === selectedFestivalId ? 10 : 1,
        clickable: true,
      });
      overlaysRef.current.set(id, newOverlay);
    });
    // 선택 변경시에만 실행 (festivals 변경은 위 effect에서 별도 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFestivalId]);

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

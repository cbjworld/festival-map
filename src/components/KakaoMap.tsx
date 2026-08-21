"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { Festival } from "@/types/festival";

const KOREA_CENTER = { lat: 36.2, lng: 127.8 };
const DEFAULT_LEVEL = 13;
// 카카오맵 레벨이 이 값 이상(=많이 축소된 상태)이면 마커를 개별로 그리지 않고 클러스터로 묶는다.
// 숫자가 클수록 더 축소된 상태라, 전국/광역 단위로 볼 때만 클러스터링하고
// 시/군/구 단위로 확대하면 다시 개별 마커가 보이도록 한다.
const CLUSTER_LEVEL_THRESHOLD = 8;

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
  /**
   * 최초 위치 확인이 끝났는지(성공/실패 상관없이) 여부.
   * false인 동안은 지도를 만들지 않고 기다렸다가, true가 되면 그 시점의 userLocation을
   * 기준으로 바로 지도를 생성한다 - "전국 지도가 잠깐 보였다가 내 위치로 이동하는" 깜빡임을 피하기 위함.
   * 전달하지 않으면(=undefined) 기존처럼 기다리지 않고 바로 생성한다.
   */
  isInitialLocationResolved?: boolean;
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

interface FestivalCluster {
  lat: number;
  lng: number;
  items: Festival[];
}

/**
 * 축제 목록을 격자(grid)로 묶어 클러스터를 계산한다.
 * level이 클수록(더 축소된 상태) 격자 칸을 크게 잡아서 더 넓은 범위를 하나로 묶는다.
 * 정교한 지도 클러스터링 라이브러리 대신, CustomOverlay 기반 마커 구조를 그대로
 * 활용할 수 있도록 간단한 위경도 격자 방식으로 구현했다.
 */
function computeClusters(festivals: Festival[], level: number): FestivalCluster[] {
  const cellSizeDeg = 0.05 * Math.max(1, level - CLUSTER_LEVEL_THRESHOLD + 2);
  const groups = new Map<string, Festival[]>();

  festivals.forEach((festival) => {
    const cellKey = `${Math.round(festival.lat / cellSizeDeg)}_${Math.round(festival.lng / cellSizeDeg)}`;
    const group = groups.get(cellKey);
    if (group) {
      group.push(festival);
    } else {
      groups.set(cellKey, [festival]);
    }
  });

  return Array.from(groups.values()).map((items) => {
    const lat = items.reduce((sum, f) => sum + f.lat, 0) / items.length;
    const lng = items.reduce((sum, f) => sum + f.lng, 0) / items.length;
    return { lat, lng, items };
  });
}

/** 클러스터(묶음) 마커 HTML - 개수에 따라 크기가 조금씩 커진다 */
function buildClusterHtml(count: number): string {
  const size = count >= 50 ? 56 : count >= 10 ? 46 : 38;
  const fontSize = count >= 50 ? 16 : count >= 10 ? 14 : 13;
  return `
    <div class="festival-cluster" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">
      ${count}
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
    .festival-cluster {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: rgba(17, 17, 17, 0.88);
      color: #fff;
      font-weight: 700;
      border: 2px solid white;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      transition: transform 0.15s ease-out;
    }
    .festival-cluster:hover {
      transform: scale(1.08);
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
  isInitialLocationResolved,
  onMapClick,
  onReady,
}: KakaoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const overlaysRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());
  const clusterOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const userLocationOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  // 축소 정도에 따라 마커를 개별로 보여줄지, 묶어서(클러스터) 보여줄지 결정하는 데 쓰인다.
  const [mapLevel, setMapLevel] = useState(DEFAULT_LEVEL);
  const isClustered = mapLevel >= CLUSTER_LEVEL_THRESHOLD;

  const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? "";

  // 지도 최초 생성
  // isInitialLocationResolved가 명시적으로 전달된 경우, 위치 확인이 끝날 때까지 기다렸다가
  // 그 시점의 userLocation으로 바로 지도를 만든다 (전국 지도 -> 내 위치로 튀는 깜빡임 방지).
  const waitingForLocation = isInitialLocationResolved === false;
  useEffect(() => {
    if (!isSdkLoaded || !mapContainerRef.current || mapRef.current || waitingForLocation) return;

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
      setMapLevel(map.getLevel());

      // 마커가 아닌 지도 빈 공간을 클릭하면 상세 카드를 닫을 수 있도록 알림
      window.kakao.maps.event.addListener(map, "click", () => {
        onMapClick?.();
      });

      // 확대/축소 정도에 따라 마커 클러스터링 여부를 갱신
      window.kakao.maps.event.addListener(map, "zoom_changed", () => {
        setMapLevel(map.getLevel());
      });

      setIsMapReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSdkLoaded, waitingForLocation]);

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

  // 축제 목록/축소 정도가 바뀔 때마다 마커(CustomOverlay) 동기화
  // 많이 축소된 상태(isClustered)에서는 개별 마커 대신 묶음(클러스터) 마커를 그린다.
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const map = mapRef.current;

    if (isClustered) {
      // 개별 마커는 모두 정리하고, 격자 기반 클러스터로 다시 그린다.
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current.clear();
      clusterOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      clusterOverlaysRef.current = [];

      const clusters = computeClusters(festivals, mapLevel);

      clusters.forEach((cluster) => {
        // 격자 안에 하나만 있으면 클러스터 대신 일반 마커로 보여준다.
        if (cluster.items.length === 1) {
          const festival = cluster.items[0];
          const isSelected = festival.id === selectedFestivalId;
          const wrapper = document.createElement("div");
          wrapper.innerHTML = buildMarkerHtml(festival, isSelected, false);
          wrapper.style.zIndex = isSelected ? "10" : "1";
          wrapper.addEventListener("click", (e) => {
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
          return;
        }

        const wrapper = document.createElement("div");
        wrapper.innerHTML = buildClusterHtml(cluster.items.length);
        wrapper.addEventListener("click", (e) => {
          e.stopPropagation();
          map.panTo(new window.kakao.maps.LatLng(cluster.lat, cluster.lng));
          // 클러스터를 눌러 확대하면 묶음이 풀릴 정도까지 줌인
          map.setLevel(Math.max(3, CLUSTER_LEVEL_THRESHOLD - 2));
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(cluster.lat, cluster.lng),
          content: wrapper,
          map,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 8,
          clickable: true,
        });
        clusterOverlaysRef.current.push(overlay);
      });

      return;
    }

    // 클러스터 모드가 아니면 클러스터 오버레이를 정리한다.
    clusterOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    clusterOverlaysRef.current = [];

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
  }, [festivals, isMapReady, isClustered, mapLevel]);

  // 선택/호버된 마커가 바뀔 때, 영향받는 마커(이전 값 + 새 값)만 다시 그려 강조 표시
  const prevSelectedRef = useRef<string | null>(null);
  const prevHoveredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    // 클러스터 모드에서는 개별 마커 오버레이가 없을 수 있어(묶여있음) 이 효과를 건너뛴다.
    // 클러스터 모드일 땐 위쪽 동기화 effect가 mapLevel 변화에 맞춰 전체를 다시 그린다.
    if (isClustered) {
      prevSelectedRef.current = selectedFestivalId;
      prevHoveredRef.current = hoveredFestivalId ?? null;
      return;
    }
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
  }, [selectedFestivalId, hoveredFestivalId, isMapReady, isClustered]);

  // 선택된 축제로 지도 중심 이동 (클러스터로 묶여 안 보이는 상태였다면 풀릴 정도까지 확대)
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !selectedFestivalId) return;
    const festival = festivals.find((f) => f.id === selectedFestivalId);
    if (!festival) return;
    const map = mapRef.current;
    map.panTo(new window.kakao.maps.LatLng(festival.lat, festival.lng));
    if (map.getLevel() >= CLUSTER_LEVEL_THRESHOLD) {
      map.setLevel(Math.max(3, CLUSTER_LEVEL_THRESHOLD - 2));
    }
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

"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Loader2, List, LocateFixed, MapPin } from "lucide-react";
import type { Festival, RegionFilter, StatusFilter } from "@/types/festival";
import FestivalDetailCard from "@/components/FestivalDetailCard";
import FestivalList from "@/components/FestivalList";
import type { KakaoMapControls } from "@/components/KakaoMap";
import { REGION_CENTERS } from "@/lib/regionCenters";
import { useFavorites } from "@/hooks/useFavorites";

// 카카오맵은 브라우저 전역(window.kakao)에 의존하므로 SSR 비활성화
const KakaoMap = dynamic(() => import("@/components/KakaoMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#f5f5f7]">
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  ),
});

/** Date -> "YYYY-MM-DD" (date input value 포맷) */
function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function Home() {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [region, setRegion] = useState<RegionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showEnded, setShowEnded] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  // 기본 기간: 오늘 ~ 한 달 후 (초기값은 SSR/CSR 불일치를 피하기 위해 마운트 후 채운다)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isMobileListOpen, setIsMobileListOpen] = useState(false);

  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(
    null,
  );
  // 리스트에서 커서를 올린 축제 - 지도의 해당 마커를 강조 표시
  const [hoveredFestivalId, setHoveredFestivalId] = useState<string | null>(
    null,
  );
  const [userLocation, setUserLocation] = useState<
    { lat: number; lng: number } | null
  >(null);

  // 카카오톡 공유 링크(?festivalId=...)로 들어왔을 때 한 번만 적용하기 위한 플래그
  const hasAppliedSharedLinkRef = useRef(false);
  // 지도 제어 함수(panTo 등) - KakaoMap이 준비되면 채워진다
  const mapControlsRef = useRef<KakaoMapControls | null>(null);

  // 축제 데이터 로드 (API Route -> TourAPI, 1시간 캐시)
  useEffect(() => {
    let cancelled = false;

    async function loadFestivals() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch("/api/festivals");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data.error ?? "축제 정보를 불러오지 못했습니다.");
        }
        setFestivals(data.festivals as Festival[]);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadFestivals();
    return () => {
      cancelled = true;
    };
  }, []);

  // 기본 기간(오늘 ~ 한 달 후) 세팅 - 마운트 후 클라이언트에서만 계산
  useEffect(() => {
    const today = new Date();
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    setDateFrom(formatDateInput(today));
    setDateTo(formatDateInput(oneMonthLater));
  }, []);

  // 카카오톡 "공유하기"로 받은 링크(?festivalId=...)로 들어온 경우,
  // 축제 데이터가 로드되자마자 해당 축제를 자동으로 선택해서 상세 카드를 띄운다.
  useEffect(() => {
    if (hasAppliedSharedLinkRef.current) return;
    if (festivals.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const sharedFestivalId = params.get("festivalId");
    hasAppliedSharedLinkRef.current = true;

    if (!sharedFestivalId) return;

    const target = festivals.find((f) => f.id === sharedFestivalId);
    if (!target) return;

    // 공유받은 축제가 현재 필터 조건(지역/상태/기간) 때문에 지도에 안 보일 수 있으니
    // 필터를 기본값으로 되돌려 반드시 마커가 보이도록 한다.
    setRegion("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    if (target.status === "ended") setShowEnded(true);

    setSelectedFestivalId(target.id);

    // 새로고침 시 같은 링크가 계속 재적용되는 걸 막기 위해 URL의 쿼리스트링을 정리
    window.history.replaceState(null, "", window.location.pathname);
  }, [festivals]);

  // 사용자 위치 요청 (최초 진입 시 자동 1회 + "내 위치로 이동" 버튼에서 재사용)
  const requestUserLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // 위치 권한 거부/실패 시 대한민국 중심부 유지
      },
      { timeout: 5000 },
    );
  }, []);

  useEffect(() => {
    requestUserLocation();
  }, [requestUserLocation]);

  // 지역/기간/검색어/종료축제 표시 여부까지만 적용한 목록. 상태(진행중/예정) 필터는 아직 적용 전이라,
  // 이 목록을 기준으로 통계(전체/진행중/개최예정)를 내면 세 숫자가 같은 지역·기간 범위를 가리키게 된다.
  const visibleFestivals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return festivals.filter((festival) => {
      if (!showEnded && festival.status === "ended") return false;
      if (showFavoritesOnly && !favorites.has(festival.id)) return false;
      if (region !== "all" && festival.region !== region) return false;

      // 선택한 기간과 축제 진행 기간이 겹치는 경우만 표시
      if (dateFrom && festival.endDate < dateFrom) return false;
      if (dateTo && festival.startDate > dateTo) return false;

      if (query) {
        const haystack = `${festival.title} ${festival.addr}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [festivals, region, showEnded, showFavoritesOnly, favorites, searchQuery, dateFrom, dateTo]);

  // 실제로 지도/목록에 그리는 대상: 위 visibleFestivals에 상태 필터까지 마저 적용
  const filteredFestivals = useMemo(() => {
    if (statusFilter === "all") return visibleFestivals;
    return visibleFestivals.filter((festival) => festival.status === statusFilter);
  }, [visibleFestivals, statusFilter]);

  const selectedFestival = useMemo(
    () => festivals.find((f) => f.id === selectedFestivalId) ?? null,
    [festivals, selectedFestivalId],
  );

  const ongoingCount = useMemo(
    () => visibleFestivals.filter((f) => f.status === "ongoing").length,
    [visibleFestivals],
  );
  const upcomingCount = useMemo(
    () => visibleFestivals.filter((f) => f.status === "upcoming").length,
    [visibleFestivals],
  );

  function handleSelectFestival(festival: Festival) {
    setSelectedFestivalId(festival.id);
    setIsMobileListOpen(false);
  }

  // 지역 버튼 선택 -> 해당 지역으로 지도 이동 (전국 선택 시 현재 내 위치로 이동)
  function handleRegionSelect(nextRegion: RegionFilter) {
    setRegion(nextRegion);

    if (nextRegion === "all") {
      if (userLocation) {
        mapControlsRef.current?.panTo(userLocation.lat, userLocation.lng, 7);
      } else {
        requestUserLocation();
      }
      return;
    }

    const center = REGION_CENTERS[nextRegion];
    if (center) {
      mapControlsRef.current?.panTo(center.lat, center.lng, center.level);
    }
  }

  // "내 위치로 이동" 버튼
  function handleLocateMe() {
    if (userLocation) {
      mapControlsRef.current?.panTo(userLocation.lat, userLocation.lng, 7);
    } else {
      requestUserLocation();
    }
  }

  const listProps = {
    festivals: filteredFestivals,
    totalCount: filteredFestivals.length,
    ongoingCount,
    upcomingCount,
    region,
    onRegionChange: handleRegionSelect,
    statusFilter,
    onStatusFilterChange: setStatusFilter,
    showEnded,
    onShowEndedChange: setShowEnded,
    favorites,
    onToggleFavorite: toggleFavorite,
    showFavoritesOnly,
    onShowFavoritesOnlyChange: setShowFavoritesOnly,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    dateFrom,
    onDateFromChange: setDateFrom,
    dateTo,
    onDateToChange: setDateTo,
    selectedFestivalId,
    onSelectFestival: handleSelectFestival,
    hoveredFestivalId,
    onHoverFestival: setHoveredFestivalId,
  };

  return (
    <main className="flex h-dvh w-full overflow-hidden bg-[#f5f5f7]">
      {/* 데스크톱: 좌측 고정 리스트 패널 */}
      <aside className="hidden w-[400px] shrink-0 border-r border-black/[0.06] bg-white/80 backdrop-blur-xl md:flex md:flex-col">
        <FestivalList {...listProps} />
      </aside>

      {/* 지도 영역 */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <KakaoMap
          festivals={filteredFestivals}
          selectedFestivalId={selectedFestivalId}
          onSelectFestival={handleSelectFestival}
          hoveredFestivalId={hoveredFestivalId}
          userLocation={userLocation}
          onMapClick={() => setSelectedFestivalId(null)}
          onReady={(controls) => {
            mapControlsRef.current = controls;
          }}
        />

        {/* 모바일 전용 상단 플로팅 바 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 md:hidden">
          <span className="pointer-events-auto rounded-full border border-white/60 bg-white/80 px-4 py-2 text-[14px] font-semibold text-gray-900 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl">
            전국 축제 지도
          </span>
          <span className="pointer-events-auto rounded-full border border-white/60 bg-white/80 px-3 py-2 text-[12px] font-medium text-gray-600 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl">
            진행 중 <span className="font-semibold text-green-600">{ongoingCount}</span>
          </span>
        </div>

        {/* 내 위치로 이동 버튼 */}
        <button
          onClick={handleLocateMe}
          aria-label="현재 위치로 이동"
          className="pointer-events-auto absolute bottom-24 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/85 text-gray-700 shadow-[0_8px_24px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-transform active:scale-95 md:bottom-6"
        >
          <LocateFixed className="h-5 w-5" strokeWidth={2.25} />
        </button>

        {/* 모바일 전용 "목록" 버튼 */}
        <button
          onClick={() => setIsMobileListOpen(true)}
          className="pointer-events-auto absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] md:hidden"
        >
          <List className="h-4 w-4" strokeWidth={2.5} />
          목록 보기 · {filteredFestivals.length}개
        </button>

        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/60 bg-white/80 px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.1)] backdrop-blur-xl">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-[14px] text-gray-600">축제 정보를 불러오는 중…</span>
            </div>
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className="absolute inset-x-4 top-20 z-10 flex items-center gap-2.5 rounded-2xl border border-red-100 bg-white/90 p-4 text-[14px] text-red-500 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl md:left-5 md:top-5 md:right-auto md:w-96">
            <MapPin className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* 상세 카드: 모바일은 하단 시트, 데스크톱은 지도 영역 좌상단에 떠 있는 카드 */}
        {selectedFestival && (
          <FestivalDetailCard
            festival={selectedFestival}
            onClose={() => setSelectedFestivalId(null)}
            isFavorite={isFavorite(selectedFestival.id)}
            onToggleFavorite={() => toggleFavorite(selectedFestival.id)}
          />
        )}
      </div>

      {/* 모바일 전용 풀스크린 목록 시트 */}
      {isMobileListOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white/95 backdrop-blur-xl animate-in slide-in-from-bottom duration-300 md:hidden">
          <FestivalList
            {...listProps}
            onRequestClose={() => setIsMobileListOpen(false)}
          />
        </div>
      )}
    </main>
  );
}

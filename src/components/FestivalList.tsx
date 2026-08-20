"use client";

import { useMemo } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import FestivalRow from "@/components/FestivalRow";
import type { Festival, RegionFilter, StatusFilter } from "@/types/festival";
import { REGION_LABELS } from "@/types/festival";

const REGION_OPTIONS: RegionFilter[] = [
  "all",
  "seoul",
  "gyeonggi",
  "gangwon",
  "chungcheong",
  "jeolla",
  "gyeongsang",
  "jeju",
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "ongoing", label: "진행 중" },
  { value: "upcoming", label: "예정" },
];

interface FestivalListProps {
  festivals: Festival[];
  totalCount: number;
  ongoingCount: number;
  upcomingCount: number;

  region: RegionFilter;
  onRegionChange: (region: RegionFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  showEnded: boolean;
  onShowEndedChange: (show: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;

  selectedFestivalId: string | null;
  onSelectFestival: (festival: Festival) => void;

  /** 모바일 풀스크린 시트로 쓰일 때만 전달 (닫기 버튼 표시) */
  onRequestClose?: () => void;
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-2xl bg-black/[0.03] py-3">
      <span className="text-[20px] font-semibold tracking-tight text-gray-900">
        {value}
      </span>
      <span className="mt-0.5 text-[11.5px] text-gray-400">{label}</span>
    </div>
  );
}

/** 버튼식 필터 그룹 (지역/상태 공통) */
function FilterButtonGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition-colors",
            value === option.value
              ? "bg-gray-900 text-white"
              : "bg-black/[0.04] text-gray-600 hover:bg-black/[0.08]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 좌측 사이드바(데스크톱)와 풀스크린 시트(모바일)에서 공통으로 쓰는
 * 검색 + 필터 + 통계 + 섹션별 축제 리스트.
 */
export default function FestivalList({
  festivals,
  totalCount,
  ongoingCount,
  upcomingCount,
  region,
  onRegionChange,
  statusFilter,
  onStatusFilterChange,
  showEnded,
  onShowEndedChange,
  searchQuery,
  onSearchQueryChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  selectedFestivalId,
  onSelectFestival,
  onRequestClose,
}: FestivalListProps) {
  const sections = useMemo(() => {
    const today = new Date();
    const daysUntil = (dateStr: string) => {
      const d = new Date(dateStr);
      return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    const ongoing = festivals
      .filter((f) => f.status === "ongoing")
      .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
    const upcoming = festivals
      .filter((f) => f.status === "upcoming")
      .sort((a, b) => a.dDay - b.dDay);
    const ended = festivals
      .filter((f) => f.status === "ended")
      .sort((a, b) => daysUntil(b.endDate) - daysUntil(a.endDate));

    return [
      { key: "ongoing", label: "진행 중", items: ongoing },
      { key: "upcoming", label: "개최 예정", items: upcoming },
      { key: "ended", label: "종료/기타", items: ended },
    ].filter((section) => section.items.length > 0);
  }, [festivals]);

  const hasDateFilter = Boolean(dateFrom || dateTo);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-4 p-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
              전국 축제 지도
            </h1>
            <p className="text-[13px] text-gray-400">한국관광공사 축제 정보</p>
          </div>
          {onRequestClose && (
            <button
              onClick={onRequestClose}
              aria-label="닫기"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-gray-600"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-black/[0.04] px-3.5 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.25} />
          <input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="축제 이름 또는 장소 검색"
            className="w-full bg-transparent text-[14.5px] text-gray-900 outline-none placeholder:text-gray-400"
          />
          {searchQuery && (
            <button onClick={() => onSearchQueryChange("")} aria-label="검색어 지우기">
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <StatTile label="진행 중" value={ongoingCount} />
          <StatTile label="개최 예정" value={upcomingCount} />
          <StatTile label="전체" value={totalCount} />
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-gray-500">지역</p>
          <FilterButtonGroup
            options={REGION_OPTIONS.map((r) => ({ value: r, label: REGION_LABELS[r] }))}
            value={region}
            onChange={onRegionChange}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-gray-500">기간</p>
            {hasDateFilter && (
              <button
                onClick={() => {
                  onDateFromChange("");
                  onDateToChange("");
                }}
                className="text-[12px] font-medium text-gray-400 underline decoration-gray-300 underline-offset-2"
              >
                초기화
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="min-w-0 flex-1 rounded-xl bg-black/[0.04] px-3 py-2 text-[13.5px] text-gray-900 outline-none"
            />
            <span className="shrink-0 text-gray-300">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="min-w-0 flex-1 rounded-xl bg-black/[0.04] px-3 py-2 text-[13.5px] text-gray-900 outline-none"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-gray-500">상태</p>
          <FilterButtonGroup
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={onStatusFilterChange}
          />
        </div>

        <button
          onClick={() => onShowEndedChange(!showEnded)}
          className="text-[12.5px] font-medium text-gray-400 underline decoration-gray-300 underline-offset-2"
        >
          {showEnded ? "종료된 축제 숨기기" : "종료된 축제도 보기"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {festivals.length === 0 ? (
          <p className="px-2 py-10 text-center text-[13.5px] text-gray-400">
            조건에 맞는 축제가 없습니다.
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.key} className="mb-2">
              <p className="px-3 py-2 text-[12.5px] font-semibold text-gray-400">
                {section.label} <span className="text-gray-300">{section.items.length}</span>
              </p>
              <div className="space-y-0.5">
                {section.items.map((festival) => (
                  <FestivalRow
                    key={festival.id}
                    festival={festival}
                    isSelected={festival.id === selectedFestivalId}
                    onClick={() => onSelectFestival(festival)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

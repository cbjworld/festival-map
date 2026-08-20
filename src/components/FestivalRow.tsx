"use client";

import Image from "next/image";
import { Heart, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Festival } from "@/types/festival";

interface FestivalRowProps {
  festival: Festival;
  isSelected: boolean;
  isHovered?: boolean;
  isFavorite?: boolean;
  onClick: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onToggleFavorite?: () => void;
}

const DOT_COLOR: Record<Festival["status"], string> = {
  ongoing: "bg-green-500",
  upcoming: "bg-yellow-500",
  ended: "bg-gray-300",
};

function formatDDay(dDay: number, status: Festival["status"]): string {
  if (status === "ongoing") return "진행중";
  if (dDay === 0) return "D-Day";
  if (dDay > 0) return `D-${dDay}`;
  return "종료";
}

/** 리스트 안의 축제 한 줄(row). 썸네일 + 제목 + 주소 + D-day로 구성된 컴팩트 카드. */
export default function FestivalRow({
  festival,
  isSelected,
  isHovered,
  isFavorite,
  onClick,
  onHoverStart,
  onHoverEnd,
  onToggleFavorite,
}: FestivalRowProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition-colors md:gap-3 md:px-3 md:py-2.5",
        isSelected
          ? "bg-black/[0.05]"
          : isHovered
            ? "bg-black/[0.035]"
            : "hover:bg-black/[0.03]",
      )}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 md:h-14 md:w-14">
        {festival.image ? (
          <Image
            src={festival.image}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <MapPin className="h-5 w-5" />
          </div>
        )}
        {onToggleFavorite && (
          <span
            role="button"
            tabIndex={0}
            aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite();
              }
            }}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
          >
            <Heart
              className={cn("h-3 w-3", isFavorite ? "fill-red-500 text-red-500" : "text-white")}
              strokeWidth={2.5}
            />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full md:h-1.5 md:w-1.5", DOT_COLOR[festival.status])} />
          <p className="truncate text-[16px] font-medium text-gray-900 md:text-[14.5px]">
            {festival.title}
          </p>
        </div>
        <p className="mt-1 truncate text-[13.5px] text-gray-400 md:mt-0.5 md:text-[12.5px]">
          {festival.addr || "주소 정보 없음"}
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold md:text-[11px]",
          festival.status === "ongoing"
            ? "bg-green-50 text-green-600"
            : festival.status === "upcoming"
              ? "bg-yellow-50 text-yellow-700"
              : "bg-gray-100 text-gray-400",
        )}
      >
        {formatDDay(festival.dDay, festival.status)}
      </span>
    </button>
  );
}

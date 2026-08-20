"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Festival } from "@/types/festival";

interface FestivalRowProps {
  festival: Festival;
  isSelected: boolean;
  onClick: () => void;
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
  onClick,
}: FestivalRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
        isSelected ? "bg-black/[0.05]" : "hover:bg-black/[0.03]",
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {festival.image ? (
          <Image
            src={festival.image}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <MapPin className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_COLOR[festival.status])} />
          <p className="truncate text-[14.5px] font-medium text-gray-900">
            {festival.title}
          </p>
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-gray-400">
          {festival.addr || "주소 정보 없음"}
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
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

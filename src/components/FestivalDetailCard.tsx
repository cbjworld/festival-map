"use client";

import { useState, useRef, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { MapPin, Navigation, Share2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Festival } from "@/types/festival";

/** 아래로 이만큼(px) 이상 드래그하면 놓았을 때 카드를 닫는다 */
const DRAG_CLOSE_THRESHOLD = 80;

interface FestivalDetailCardProps {
  festival: Festival;
  onClose: () => void;
}

/** 상태별 뱃지 스타일/라벨 (점 인디케이터 + 텍스트) */
const STATUS_BADGE: Record<
  Festival["status"],
  { label: string; dot: string; text: string }
> = {
  ongoing: { label: "진행 중", dot: "bg-green-500", text: "text-green-700" },
  upcoming: { label: "개최 예정", dot: "bg-yellow-500", text: "text-yellow-700" },
  ended: { label: "종료/기타", dot: "bg-gray-400", text: "text-gray-500" },
};

/** D-Day 뱃지 텍스트 계산 */
function formatDDay(dDay: number, status: Festival["status"]): string {
  if (status === "ongoing") return "진행중";
  if (dDay === 0) return "D-Day";
  if (dDay > 0) return `D-${dDay}`;
  return "종료";
}

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

function handleKakaoShare(festival: Festival) {
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?festivalId=${festival.id}`
      : "";

  if (typeof window !== "undefined" && window.Kakao?.isInitialized()) {
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: festival.title,
        description: `${festival.startDate} ~ ${festival.endDate} | ${festival.addr}`,
        imageUrl: festival.image ?? `${window.location.origin}/og-default.png`,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
      buttons: [
        {
          title: "자세히 보기",
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
      ],
    });
    return;
  }

  // 카카오 SDK 미초기화 시 폴백: 링크 복사
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl);
    window.alert("공유 링크가 복사되었습니다.");
  }
}

function openKakaoMapDirections(festival: Festival) {
  const url = `https://map.kakao.com/link/to/${encodeURIComponent(
    festival.title,
  )},${festival.lat},${festival.lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function FestivalDetailCard({
  festival,
  onClose,
}: FestivalDetailCardProps) {
  const badge = STATUS_BADGE[festival.status];

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);

  function handleHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    const delta = e.clientY - dragStartYRef.current;
    if (delta > 0) setDragOffset(delta);
  }

  function handleHandlePointerUp() {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset > DRAG_CLOSE_THRESHOLD) {
      onClose();
    }
    setDragOffset(0);
  }

  return (
    <div
      className={cn(
        // 모바일: 뷰포트 하단 슬라이드업 시트 / 데스크톱(md 이상): 지도 영역(부모가 relative) 좌상단에 뜨는 카드
        "fixed inset-x-0 bottom-0 z-30 max-h-[75vh] overflow-y-auto rounded-t-[28px] border border-white/60 bg-white/85 shadow-[0_-8px_40px_rgba(0,0,0,0.16)] backdrop-blur-2xl animate-in slide-in-from-bottom duration-300",
        "md:absolute md:inset-auto md:left-5 md:top-5 md:bottom-auto md:right-auto md:w-[380px] md:max-h-[calc(100%-2.5rem)] md:rounded-[28px] md:border md:shadow-[0_8px_40px_rgba(0,0,0,0.14)] md:slide-in-from-left",
      )}
      style={{
        transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
        transition: isDragging ? "none" : undefined,
      }}
    >
      {/* 모바일 전용 드래그 핸들: 탭하면 바로 닫히고, 아래로 드래그해도 닫힌다 */}
      <div
        className="cursor-grab touch-none pb-1 pt-2 md:hidden"
        onClick={onClose}
        onPointerDown={handleHandlePointerDown}
        onPointerMove={handleHandlePointerMove}
        onPointerUp={handleHandlePointerUp}
        onPointerCancel={handleHandlePointerUp}
      >
        <div className="sheet-handle" />
      </div>

      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.06] text-gray-600 backdrop-blur-md transition-colors hover:bg-black/10"
        aria-label="닫기"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>

      <div className="relative h-48 w-full overflow-hidden bg-gray-100 md:rounded-t-[28px]">
        {festival.image ? (
          <Image
            src={festival.image}
            alt={festival.title}
            fill
            sizes="(max-width: 768px) 100vw, 384px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <MapPin className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[12px] font-semibold backdrop-blur-md">
            <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} />
            <span className={badge.text}>{badge.label}</span>
          </span>
          <span className="rounded-full bg-black/70 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
            {formatDDay(festival.dDay, festival.status)}
          </span>
        </div>
      </div>

      <div className="space-y-5 px-6 pb-8 pt-5">
        <div>
          <h2 className="text-[21px] font-semibold leading-tight tracking-tight text-gray-900">
            {festival.title}
          </h2>
          <p className="mt-1.5 text-[14px] text-gray-400">
            {festival.startDate} ~ {festival.endDate}
          </p>
        </div>

        <div className="flex items-start gap-2.5 text-[14px] text-gray-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
          <span className="leading-relaxed">{festival.addr || "주소 정보 없음"}</span>
        </div>

        <div className="rounded-2xl bg-black/[0.035] p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-gray-500">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            AI 요약
          </div>
          <p className="text-[14px] leading-relaxed text-gray-700">
            {festival.aiSummary}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={() => openKakaoMapDirections(festival)}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-gray-900 text-[14.5px] font-semibold text-white transition-transform active:scale-[0.97]"
          >
            <Navigation className="h-4 w-4" strokeWidth={2.25} />
            길찾기
          </button>
          <button
            onClick={() => handleKakaoShare(festival)}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-black/[0.05] text-[14.5px] font-semibold text-gray-800 transition-transform active:scale-[0.97]"
          >
            <Share2 className="h-4 w-4" strokeWidth={2.25} />
            공유하기
          </button>
        </div>
      </div>
    </div>
  );
}

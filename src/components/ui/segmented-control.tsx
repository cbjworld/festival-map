"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** 옵션이 많아 한 줄에 안 들어갈 때 가로 스크롤 허용 */
  scrollable?: boolean;
}

/**
 * iOS의 UISegmentedControl을 본뜬 컴포넌트.
 * 활성화된 옵션 뒤로 흰색 "pill"이 부드럽게 슬라이드하며 이동한다.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  scrollable = false,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null,
  );

  const measure = () => {
    const container = containerRef.current;
    const active = buttonRefs.current.get(value);
    if (!container || !active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setIndicator({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
    });
  };

  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  useEffect(() => {
    const handleResize = () => measure();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex gap-0.5 rounded-full bg-black/[0.06] p-0.5 backdrop-blur-sm",
        scrollable ? "overflow-x-auto no-scrollbar" : "",
        className,
      )}
    >
      {indicator && (
        <span
          className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            if (el) buttonRefs.current.set(option.value, el);
          }}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-tight transition-colors duration-200",
            value === option.value
              ? "text-gray-900"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

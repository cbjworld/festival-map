import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스 병합 유틸 (shadcn 컨벤션) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "festival-map:favorites";

function readStoredFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function writeStoredFavorites(favorites: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {
    // 사파리 프라이빗 모드 등 저장 실패는 조용히 무시 (즐겨찾기가 이번 세션에서만 유지됨)
  }
}

/**
 * 관심 축제를 브라우저(localStorage)에 저장하는 훅.
 * 로그인 없이도 새로고침 후 유지되며, 기기/브라우저별로 별도 저장된다.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // 마운트 이후에만 localStorage를 읽어 SSR과의 hydration 불일치를 피한다.
  useEffect(() => {
    setFavorites(readStoredFavorites());
  }, []);

  const toggleFavorite = useCallback((festivalId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(festivalId)) {
        next.delete(festivalId);
      } else {
        next.add(festivalId);
      }
      writeStoredFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (festivalId: string) => favorites.has(festivalId),
    [favorites],
  );

  return { favorites, toggleFavorite, isFavorite };
}

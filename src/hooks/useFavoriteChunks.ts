import { useEffect, useRef, useState } from "react";
import type { StudentLanguage } from "../config/languages";
import { FAVORITE_CHUNKS_KEY, readFavoriteChunks, toggleFavoriteChunk } from "../utils/favoriteChunks";
import { celebrateAchievement } from "../utils/achievements";

export function useFavoriteChunks() {
  const [favorites, setFavorites] = useState(readFavoriteChunks);
  const current = useRef(favorites);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== FAVORITE_CHUNKS_KEY && event.key !== null) return;
      current.current = readFavoriteChunks();
      setFavorites(current.current);
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  function toggleFavorite(id: string, language: StudentLanguage, type?: "example") {
    const before = current.current;
    const next = toggleFavoriteChunk(before, id, language, type);
    try {
      localStorage.setItem(FAVORITE_CHUNKS_KEY, JSON.stringify(next));
      current.current = next;
      setFavorites(next);
      setStorageError(false);
      const count = (items: typeof next) => items.filter(item => item.language === language && item.type !== "example").length;
      if (count(before) < 15 && count(next) >= 15) {
        celebrateAchievement(`favorite-chunks-15:${language}`, "15 chunks favoritos!", "Você salvou 15 chunks para praticar quando quiser.");
      }
    } catch { setStorageError(true); }
  }
  return { favorites, toggleFavorite, storageError };
}

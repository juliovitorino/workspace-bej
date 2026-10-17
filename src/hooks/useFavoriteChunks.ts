import { useEffect, useRef, useState } from "react";
import type { StudentLanguage } from "../config/languages";
import { FAVORITE_CHUNKS_KEY, readFavoriteChunks, toggleFavoriteChunk } from "../utils/favoriteChunks";

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
    const next = toggleFavoriteChunk(current.current, id, language, type);
    try {
      localStorage.setItem(FAVORITE_CHUNKS_KEY, JSON.stringify(next));
      current.current = next;
      setFavorites(next);
      setStorageError(false);
    } catch { setStorageError(true); }
  }
  return { favorites, toggleFavorite, storageError };
}

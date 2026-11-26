import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const BEJ_URL = "https://bejapp.com.br";

const messages = {
  pt: { share: "Compartilhar", copied: "Conteúdo copiado para compartilhar", error: "Não foi possível compartilhar ou copiar neste navegador." },
  en: { share: "Share", copied: "Content copied for sharing", error: "Could not share or copy in this browser." },
  es: { share: "Compartir", copied: "Contenido copiado para compartir", error: "No se pudo compartir ni copiar en este navegador." },
  fr: { share: "Partager", copied: "Contenu copié pour le partage", error: "Impossible de partager ou copier dans ce navigateur." }
};

export function studyShareText(lines: Array<string | null | undefined>): string {
  return [...lines.map(line => line?.trim()).filter((line): line is string => Boolean(line)),
    "📚 Brazilian English Journey", BEJ_URL].join("\n\n");
}

async function copyForSharing(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Legacy fallback. */ }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  try {
    field.focus();
    field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
  } finally {
    field.remove();
  }
}

/** Shares the exact study item; uses native sharing where available and clipboard otherwise. */
export function ShareStudyButton({ content, className, label }: { content: () => string; className: string; label?: string }) {
  const { i18n } = useTranslation();
  const language = i18n.language.toLowerCase();
  const labels = language.startsWith("pt") ? messages.pt : language.startsWith("es") ? messages.es
    : language.startsWith("fr") ? messages.fr : messages.en;
  const [status, setStatus] = useState<"copied" | "error" | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);

  async function share() {
    const text = content();
    if (!text.trim()) return;
    if (timeout.current) clearTimeout(timeout.current);
    setStatus(null);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Brazilian English Journey", text });
        return;
      } catch (error) {
        // Cancelling the native sheet must not silently copy private study text.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await copyForSharing(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    timeout.current = setTimeout(() => setStatus(null), 3500);
  }

  return <>
    <button type="button" className={className} onClick={() => void share()}
      aria-label={label ?? labels.share} title={label ?? labels.share}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <path d="m8.7 10.6 6.6-4.2m-6.6 7 6.6 4.2"/>
      </svg>
    </button>
    {status && <span role={status === "error" ? "alert" : "status"} className="bej-share-feedback">
      {status === "copied" ? labels.copied : labels.error}
    </span>}
  </>;
}

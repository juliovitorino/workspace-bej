import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import "./IntentionCard.desktop.css";
import { useEffect, useRef, useState } from "react";
import type { MentalIntention } from "../types/hashmap";
import { isAuthorMode } from "../utils/authorMode";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";

interface IntentionCardProps {
  item: MentalIntention;
  sourceLanguage: SourceLanguage;
  language: StudentLanguage;
  onSelect: (item: MentalIntention) => void;
}

export function IntentionCard({ item, sourceLanguage, language, onSelect }: IntentionCardProps) {
  const { t } = useTranslation();
  const hasYoutubeVideo = typeof item.youtubeVideo === "string" && item.youtubeVideo.trim().length > 0;
  const hasYoutubeShort = typeof item.youtubeShort === "string" && item.youtubeShort.trim().length > 0;
  const authorMode = isAuthorMode();
  const [copiedId, setCopiedId] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeout.current !== null) clearTimeout(feedbackTimeout.current);
    };
  }, []);

  async function copyId() {
    if (!isAuthorMode()) return;

    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(item.id);
          copied = true;
        } catch {
          // Tenta o método alternativo quando o navegador bloqueia a API.
        }
      }

      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = item.id;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        try {
          textarea.focus();
          textarea.select();
          textarea.setSelectionRange(0, item.id.length);
          if (!document.execCommand("copy")) throw new Error(t("common.failedToCopyId"));
        } finally {
          document.body.removeChild(textarea);
        }
      }

      setCopiedId(true);
      setCopyError(false);
      if (feedbackTimeout.current !== null) clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => setCopiedId(false), 1500);
    } catch {
      setCopiedId(false);
      setCopyError(true);
    }
  }

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
    <div
      className="intention-card bej-intention-card--desktop"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
    >
      <div className="bej-intention-card__text">
        <h2>{item.intention}</h2>
        <p className="english">{item.targetIntention ?? item.english}</p>
        {authorMode && (hasYoutubeVideo || hasYoutubeShort) && (
          <div
            aria-label={t("hashmap.contentPublishedOnYoutube")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}
          >
            {hasYoutubeVideo && (
              <img
                src="/images/youtube-video.png"
                alt={t("hashmap.videoPublishedOnYoutube")}
                title={t("hashmap.videoPublishedOnYoutube")}
                width={25}
                height={25}
                style={{ objectFit: "contain", display: "block" }}
              />
            )}
            {hasYoutubeShort && (
              <img
                src="/images/youtube-short.png"
                alt={t("hashmap.shortPublishedOnYoutube")}
                title={t("hashmap.shortPublishedOnYoutube")}
                width={25}
                height={25}
                style={{ objectFit: "contain", display: "block" }}
              />
            )}
          </div>
        )}
      </div>

      <div className="card-meta">
        {item.pattern && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", minWidth: 0 }}>
            <span style={{ overflowWrap: "anywhere" }}>{item.pattern}</span>
          </div>
        )}

        <div className="card-badges">
          {item.englishLevel && (
            <span className="pill english-level-pill">
              {item.englishLevel}
            </span>
          )}

          {item.category && (
            <span className="pill category-pill">{item.category}</span>
          )}

          {authorMode && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void copyId();
              }}
              onKeyDown={(event) => event.stopPropagation()}
              title={copiedId ? t("common.idCopied") : t("common.copyIntentionId")}
              aria-label={copiedId ? t("common.idCopied") : t("common.copyIntentionIdForIntention", { intention: item.intention })}
              style={{
                width: "2.25rem",
                height: "2.25rem",
                flexShrink: 0,
                padding: 0,
                border: "1px solid var(--border-strong)",
                borderRadius: "0.65rem",
                background: "var(--surface-soft)",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: "1.1rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "0.25rem"
              }}
            >
              <span aria-hidden="true">{copiedId ? "✓" : "🔢"}</span>
            </button>
          )}
        </div>

        <div className="bej-intention-card__tag-columns">
          {([
            { locale: sourceLanguage, tags: item.sourceTags, label: t("hashmap.sourceTags"), side: "source" },
            { locale: language, tags: item.targetTags, label: t("hashmap.studyLanguageTags"), side: "study" }
          ]).map(({ locale, tags, label, side }) => tags && tags.length > 0 && (
            <div className={`card-tag-group bej-intention-card__tags--${side}`} key={side} role="group" aria-label={`${label}: ${LANGUAGES[locale].name}`}>
              <span className="card-tag-language" title={localizedLanguageName(locale)}>
                <span aria-hidden="true">{LANGUAGES[locale].flag}</span> {locale}
              </span>
              <div className="card-tags" lang={locale}>
                {Array.from(new Set(tags)).map(tag => <span className="tag-pill" key={tag}>{tag}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    {authorMode && copyError && (
      <p role="alert" style={{ color: "var(--bad)", margin: "0.25rem 0" }}>
        
        {t("hashmap.couldNotCopyTheIdTryAgain")}
      </p>
    )}
    </div>
  );
}

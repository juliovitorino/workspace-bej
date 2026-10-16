import { t, languageName as localizedLanguageName } from "../i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES, type SourceLanguage, type StudentLanguage } from "../config/languages";
import { createPortal } from "react-dom";

export type HqImageFilter = "all" | "with" | "without";
export type ChunkFilter = "all" | "with" | "without";
export type YoutubeFilter = "all" | "with" | "without";

interface SearchPanelProps {
  sourceLanguage: SourceLanguage;
  language: StudentLanguage;
  mentalSearch: string;
  englishSearch: string;
  categorySearch: string;
  englishLevelSearch: string;
  hqImageFilter: HqImageFilter;
  chunkFilter: ChunkFilter;
  isAuthor: boolean;
  youtubeVideoFilter: YoutubeFilter;
  youtubeShortFilter: YoutubeFilter;
  availableTags: string[];
  selectedTags: string[];
  onMentalSearchChange: (value: string) => void;
  onEnglishSearchChange: (value: string) => void;
  onCategorySearchChange: (value: string) => void;
  onEnglishLevelSearchChange: (value: string) => void;
  onHqImageFilterChange: (value: HqImageFilter) => void;
  onChunkFilterChange: (value: ChunkFilter) => void;
  onYoutubeVideoFilterChange: (value: YoutubeFilter) => void;
  onYoutubeShortFilterChange: (value: YoutubeFilter) => void;
  onTagsChange: (tags: string[]) => void;
  onClear: () => void;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

// Distância de edição: permite encontrar tags mesmo com pequenos erros de digitação.
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function tagMatchScore(tag: string, rawQuery: string): number {
  const candidate = normalize(tag);
  const query = normalize(rawQuery);
  if (!query) return 1;
  if (candidate === query) return 100;
  if (candidate.startsWith(query)) return 90;
  if (candidate.includes(query)) return 80;
  const queryWords = query.split(/\s+/).filter(Boolean);
  const candidateWords = candidate.split(/[\s_\-/]+/).filter(Boolean);
  if (queryWords.every((word) => candidateWords.some((part) => part.includes(word)))) return 70;
  const allowedDistance = query.length >= 5 ? 2 : query.length >= 3 ? 1 : 0;
  if (allowedDistance && candidateWords.some((word) => editDistance(word, query) <= allowedDistance)) return 40;
  return 0;
}

export function SearchPanel({
  sourceLanguage,
  language,
  mentalSearch,
  englishSearch,
  categorySearch,
  englishLevelSearch,
  hqImageFilter,
  chunkFilter,
  isAuthor,
  youtubeVideoFilter,
  youtubeShortFilter,
  availableTags,
  selectedTags,
  onMentalSearchChange,
  onEnglishSearchChange,
  onCategorySearchChange,
  onEnglishLevelSearchChange,
  onHqImageFilterChange,
  onChunkFilterChange,
  onYoutubeVideoFilterChange,
  onYoutubeShortFilterChange,
  onTagsChange,
  onClear
}: SearchPanelProps) {
  const { t } = useTranslation();
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const hasFilters = Boolean(
    mentalSearch || englishSearch || categorySearch || englishLevelSearch ||
    hqImageFilter !== "all" || chunkFilter !== "all" ||
    (isAuthor && (youtubeVideoFilter !== "all" || youtubeShortFilter !== "all")) ||
    selectedTags.length > 0
  );

  const matchingTags = useMemo(() => {
    return availableTags
      .map((tag) => ({ tag, score: tagMatchScore(tag, tagQuery) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag, sourceLanguage))
      .map(({ tag }) => tag);
  }, [availableTags, tagQuery, sourceLanguage]);

  function openTagModal() {
    setDraftTags([...selectedTags]);
    setTagQuery("");
    setIsTagModalOpen(true);
  }

  function closeTagModal() {
    setIsTagModalOpen(false);
    setTagQuery("");
    openButtonRef.current?.focus();
  }

  function applyTags() {
    onTagsChange(draftTags);
    closeTagModal();
  }

  function toggleDraftTag(tag: string) {
    setDraftTags((current) => current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag]);
  }

  function removeTag(tag: string) {
    onTagsChange(selectedTags.filter((item) => item !== tag));
  }

  useEffect(() => {
    if (!isTagModalOpen) return;
    searchInputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsTagModalOpen(false);
        openButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isTagModalOpen]);

  return (
    <section id="hashmap-search-filters" className="search-panel">
      <div className="field">
        <label htmlFor="mental-search">{t("filters.sourceCaption", { sourceLanguage: localizedLanguageName(sourceLanguage) })}</label>
        <div className="search-input-with-clear">
        <input id="mental-search" type="search" placeholder={t("filters.searchIntentionsOrExamplesInSourcelanguage", { sourceLanguage: (LANGUAGES[sourceLanguage].name.toLowerCase()) })}
          value={mentalSearch} onChange={(event) => onMentalSearchChange(event.target.value)} autoComplete="off" />
          {Boolean(mentalSearch) && (
            <button type="button" className="secondary-button mobile-clear-search-button"
              aria-label={t("filters.clearSourceLanguageSearch")} title={t("filters.clearSourceLanguageSearch")}
              onClick={() => {
                onMentalSearchChange("");
                document.getElementById("mental-search")?.focus();
              }}>
              <span aria-hidden="true">⌫</span>
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="english-search">{t("filters.targetCaption", { targetLanguage: localizedLanguageName(language) })}</label>
        <div className="search-input-with-clear">
        <input id="english-search" type="search" placeholder={t("filters.searchIntentionsStructuresOrExamplesInTargetlanguage", { targetLanguage: (LANGUAGES[language].name.toLowerCase()) })}
          value={englishSearch} onChange={(event) => onEnglishSearchChange(event.target.value)} autoComplete="off" />
          {Boolean(englishSearch) && (
            <button type="button" className="secondary-button mobile-clear-search-button"
              aria-label={t("filters.clearStudyLanguageSearch")} title={t("filters.clearStudyLanguageSearch")}
              onClick={() => {
                onEnglishSearchChange("");
                document.getElementById("english-search")?.focus();
              }}>
              <span aria-hidden="true">⌫</span>
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="category-search">{t("common.category")}</label>
        <div className="search-input-with-clear">
        <input id="category-search" type="search" placeholder={t("filters.eGQuestionsHabitsConditions")}
          value={categorySearch} onChange={(event) => onCategorySearchChange(event.target.value)} autoComplete="off" />
          {Boolean(categorySearch) && (
            <button type="button" className="secondary-button mobile-clear-search-button"
              aria-label={t("filters.clearCategory")} title={t("filters.clearCategory")}
              onClick={() => {
                onCategorySearchChange("");
                document.getElementById("category-search")?.focus();
              }}>
              <span aria-hidden="true">⌫</span>
            </button>
          )}
        </div>
      </div>


      <div className="field">
        <label htmlFor="english-level-search">{t("common.level")}</label>
        <select id="english-level-search" value={englishLevelSearch}
          onChange={(event) => onEnglishLevelSearchChange(event.target.value)}>
          <option value="">{t("filters.allTodos")}</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="hq-image-filter">{t("common.comic")}</label>
        <select id="hq-image-filter" value={hqImageFilter}
          onChange={(event) => onHqImageFilterChange(event.target.value as HqImageFilter)}>
          <option value="all">{t("filters.all")}</option>
          <option value="with">{t("filters.withComic")}</option>
          <option value="without">{t("filters.withoutComic")}</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="chunk-filter">{t("common.chunkFlashcards")}</label>
        <select id="chunk-filter" value={chunkFilter}
          onChange={(event) => onChunkFilterChange(event.target.value as ChunkFilter)}>
          <option value="all">{t("filters.allTodos")}</option>
          <option value="with">{t("filters.withChunk")}</option>
          <option value="without">{t("filters.withoutChunk")}</option>
        </select>
      </div>

      {isAuthor && (
        <>
          <div className="field">
            <label htmlFor="youtube-video-filter">{t("filters.youtubeVideo")}</label>
            <select id="youtube-video-filter" value={youtubeVideoFilter}
              onChange={(event) => onYoutubeVideoFilterChange(event.target.value as YoutubeFilter)}>
              <option value="all">{t("filters.allTodos")}</option>
              <option value="with">{t("filters.withVideo")}</option>
              <option value="without">{t("filters.withoutVideo")}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="youtube-short-filter">YouTube Short</label>
            <select id="youtube-short-filter" value={youtubeShortFilter}
              onChange={(event) => onYoutubeShortFilterChange(event.target.value as YoutubeFilter)}>
              <option value="all">{t("filters.allTodos")}</option>
              <option value="with">{t("filters.withShort")}</option>
              <option value="without">{t("filters.withoutShort")}</option>
            </select>
          </div>
        </>
      )}

      <div className="field tag-filter-field">
        <label htmlFor="open-tag-filter">{t("filters.tags")}</label>
        <button id="open-tag-filter" ref={openButtonRef} type="button"
          className="secondary-button" onClick={openTagModal}
          aria-haspopup="dialog" aria-expanded={isTagModalOpen}
          style={{ width: "100%", textAlign: "left", minHeight: 38 }}>
          {selectedTags.length ? t("filters.selectedCountEditTags", { count: (selectedTags.length) }) : t("filters.searchAndSelectTags")}
        </button>
        {selectedTags.length > 0 && (
          <div className="selected-tags">
            {selectedTags.map((tag) => (
              <button type="button" className="selected-tag" key={tag}
                onClick={() => removeTag(tag)} title={t("filters.removeTagTag", { tag: (tag) })}>
                {tag} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="secondary-button" onClick={onClear} disabled={!hasFilters}>
        
        {t("filters.clearFilters")}
      </button>

      {isTagModalOpen && createPortal(
        <div role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeTagModal();
        }} style={{
          position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 23, 42, 0.58)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="tag-modal-title"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled])'
              ));
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first?.focus();
              }
            }}
            style={{
              width: "min(100%, 620px)", maxHeight: "min(85vh, 720px)", display: "flex",
              flexDirection: "column", borderRadius: 14, background: "var(--surface)", color: "var(--text)",
              boxShadow: "0 20px 70px rgba(0,0,0,.3)", overflow: "hidden"
            }}>
            <div style={{ padding: "20px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2 id="tag-modal-title" style={{ margin: 0, fontSize: 20 }}>{t("filters.filterByTags")}</h2>
                <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--muted)" }}>
                  
                  {t("filters.searchByNameOrPartOfAWordAndSelect")}
                </p>
              </div>
              <button type="button" onClick={closeTagModal} aria-label={t("filters.closeTagSelection")}
                style={{ border: 0, background: "transparent", fontSize: 25, cursor: "pointer", color: "var(--text-secondary)" }}>×</button>
            </div>

            <div style={{ padding: "0 22px 12px" }}>
              <input ref={searchInputRef} type="search" value={tagQuery}
                onChange={(event) => setTagQuery(event.target.value)}
                placeholder={t("filters.searchTagsEGHabitConversaGrammar")}
                aria-label={t("filters.searchTags")} autoComplete="off"
                style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 8,
                  border: "1px solid var(--border-strong)", fontSize: 15, color: "var(--text)", background: "var(--surface)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, fontSize: 13, color: "var(--muted)" }}>
                <span>{t("filters.tagsFound", { count: matchingTags.length })}</span>
                <span>{t("filters.tagsSelected", { count: draftTags.length })}</span>
              </div>
            </div>

            <div style={{ overflowY: "auto", minHeight: 110, padding: "4px 22px 12px", flex: 1 }}>
              {matchingTags.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--muted)", padding: "30px 0" }}>
                  
                  {t("filters.noSimilarTagsFoundTryAnotherWord")}
                </p>
              ) : matchingTags.map((tag) => (
                <label key={tag} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "9px 8px", borderBottom: "1px solid var(--surface-soft)", cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={draftTags.includes(tag)}
                    onChange={() => toggleDraftTag(tag)}
                    style={{ width: 17, height: 17, accentColor: "var(--accent)", flexShrink: 0 }} />
                  <span style={{ overflowWrap: "anywhere" }}>{tag}</span>
                </label>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", padding: "14px 22px", display: "flex",
              flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <button type="button" onClick={() => setDraftTags([])} disabled={draftTags.length === 0}
                style={{ background: "transparent", border: 0, color: "var(--text-secondary)", cursor: "pointer", padding: 8 }}>
                
                {t("filters.deselectAll")}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={closeTagModal}
                  style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer" }}>
                  
                  {t("filters.cancel")}
                </button>
                <button type="button" onClick={applyTags}
                  style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "var(--accent)", color: "var(--on-accent)", fontWeight: 600, cursor: "pointer" }}>
                  {t("filters.applyWithCount", { count: draftTags.length })}
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </section>
  );
}

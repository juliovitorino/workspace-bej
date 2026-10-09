import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type HqImageFilter = "all" | "with" | "without";

interface SearchPanelProps {
  mentalSearch: string;
  englishSearch: string;
  categorySearch: string;
  englishLevelSearch: string;
  hqImageFilter: HqImageFilter;
  availableTags: string[];
  selectedTags: string[];
  onMentalSearchChange: (value: string) => void;
  onEnglishSearchChange: (value: string) => void;
  onCategorySearchChange: (value: string) => void;
  onEnglishLevelSearchChange: (value: string) => void;
  onHqImageFilterChange: (value: HqImageFilter) => void;
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
  mentalSearch,
  englishSearch,
  categorySearch,
  englishLevelSearch,
  hqImageFilter,
  availableTags,
  selectedTags,
  onMentalSearchChange,
  onEnglishSearchChange,
  onCategorySearchChange,
  onEnglishLevelSearchChange,
  onHqImageFilterChange,
  onTagsChange,
  onClear
}: SearchPanelProps) {
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const hasFilters = Boolean(
    mentalSearch || englishSearch || categorySearch || englishLevelSearch ||
    hqImageFilter !== "all" || selectedTags.length > 0
  );

  const matchingTags = useMemo(() => {
    return availableTags
      .map((tag) => ({ tag, score: tagMatchScore(tag, tagQuery) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag, "pt-BR"))
      .map(({ tag }) => tag);
  }, [availableTags, tagQuery]);

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
    <section className="search-panel">
      <div className="field">
        <label htmlFor="mental-search">Intenção Mental</label>
        <input id="mental-search" type="search" placeholder="Ex.: costumava, acostumado, e se..."
          value={mentalSearch} onChange={(event) => onMentalSearchChange(event.target.value)} autoComplete="off" />
      </div>

      <div className="field">
        <label htmlFor="english-search">English</label>
        <input id="english-search" type="search" placeholder="Ex.: used to, getting used to..."
          value={englishSearch} onChange={(event) => onEnglishSearchChange(event.target.value)} autoComplete="off" />
      </div>

      <div className="field">
        <label htmlFor="category-search">Categoria</label>
        <input id="category-search" type="search" placeholder="Ex.: questions, habits, conditions..."
          value={categorySearch} onChange={(event) => onCategorySearchChange(event.target.value)} autoComplete="off" />
      </div>

      <div className="field">
        <label htmlFor="english-level-search">Nível</label>
        <select id="english-level-search" value={englishLevelSearch}
          onChange={(event) => onEnglishLevelSearchChange(event.target.value)}>
          <option value="">Todos</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="hq-image-filter">HQ</label>
        <select id="hq-image-filter" value={hqImageFilter}
          onChange={(event) => onHqImageFilterChange(event.target.value as HqImageFilter)}>
          <option value="all">Todas</option>
          <option value="with">Com HQ</option>
          <option value="without">Sem HQ</option>
        </select>
      </div>

      <div className="field tag-filter-field">
        <label htmlFor="open-tag-filter">Tags</label>
        <button id="open-tag-filter" ref={openButtonRef} type="button"
          className="secondary-button" onClick={openTagModal}
          aria-haspopup="dialog" aria-expanded={isTagModalOpen}
          style={{ width: "100%", textAlign: "left", minHeight: 38 }}>
          {selectedTags.length ? `Selecionadas: ${selectedTags.length} — editar tags` : "Pesquisar e selecionar tags..."}
        </button>
        {selectedTags.length > 0 && (
          <div className="selected-tags">
            {selectedTags.map((tag) => (
              <button type="button" className="selected-tag" key={tag}
                onClick={() => removeTag(tag)} title={`Remover tag ${tag}`}>
                {tag} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="secondary-button" onClick={onClear} disabled={!hasFilters}>
        Limpar filtros
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
              flexDirection: "column", borderRadius: 14, background: "#fff", color: "#172033",
              boxShadow: "0 20px 70px rgba(0,0,0,.3)", overflow: "hidden"
            }}>
            <div style={{ padding: "20px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2 id="tag-modal-title" style={{ margin: 0, fontSize: 20 }}>Filtrar por tags</h2>
                <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748b" }}>
                  Pesquise por nome ou parte da palavra e marque as tags desejadas.
                </p>
              </div>
              <button type="button" onClick={closeTagModal} aria-label="Fechar seleção de tags"
                style={{ border: 0, background: "transparent", fontSize: 25, cursor: "pointer", color: "#475569" }}>×</button>
            </div>

            <div style={{ padding: "0 22px 12px" }}>
              <input ref={searchInputRef} type="search" value={tagQuery}
                onChange={(event) => setTagQuery(event.target.value)}
                placeholder="Pesquisar tags... Ex.: habit, conversa, grammar"
                aria-label="Pesquisar tags" autoComplete="off"
                style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 8,
                  border: "1px solid #cbd5e1", fontSize: 15, color: "#172033", background: "#fff" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, fontSize: 13, color: "#64748b" }}>
                <span>{matchingTags.length} {matchingTags.length === 1 ? "tag encontrada" : "tags encontradas"}</span>
                <span>{draftTags.length} {draftTags.length === 1 ? "selecionada" : "selecionadas"}</span>
              </div>
            </div>

            <div style={{ overflowY: "auto", minHeight: 110, padding: "4px 22px 12px", flex: 1 }}>
              {matchingTags.length === 0 ? (
                <p style={{ textAlign: "center", color: "#64748b", padding: "30px 0" }}>
                  Nenhuma tag semelhante encontrada. Tente outra palavra.
                </p>
              ) : matchingTags.map((tag) => (
                <label key={tag} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "9px 8px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={draftTags.includes(tag)}
                    onChange={() => toggleDraftTag(tag)}
                    style={{ width: 17, height: 17, accentColor: "#2563eb", flexShrink: 0 }} />
                  <span style={{ overflowWrap: "anywhere" }}>{tag}</span>
                </label>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", padding: "14px 22px", display: "flex",
              flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <button type="button" onClick={() => setDraftTags([])} disabled={draftTags.length === 0}
                style={{ background: "transparent", border: 0, color: "#475569", cursor: "pointer", padding: 8 }}>
                Desmarcar todas
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={closeTagModal}
                  style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="button" onClick={applyTags}
                  style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  Aplicar filtros ({draftTags.length})
                </button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </section>
  );
}

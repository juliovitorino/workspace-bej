interface SearchPanelProps {
  mentalSearch: string;
  englishSearch: string;
  categorySearch: string;
  englishLevelSearch: string;
  availableTags: string[];
  selectedTags: string[];
  onMentalSearchChange: (value: string) => void;
  onEnglishSearchChange: (value: string) => void;
  onCategorySearchChange: (value: string) => void;
  onEnglishLevelSearchChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  onClear: () => void;
}

export function SearchPanel({
  mentalSearch,
  englishSearch,
  categorySearch,
  englishLevelSearch,
  availableTags,
  selectedTags,
  onMentalSearchChange,
  onEnglishSearchChange,
  onCategorySearchChange,
  onEnglishLevelSearchChange,
  onTagsChange,
  onClear
}: SearchPanelProps) {
  const hasFilters = Boolean(
    mentalSearch ||
    englishSearch ||
    categorySearch ||
    englishLevelSearch ||
    selectedTags.length > 0
  );

  const remainingTags = availableTags.filter(
    (tag) => !selectedTags.includes(tag)
  );

  function addTag(tag: string) {
    if (!tag || selectedTags.includes(tag)) {
      return;
    }

    onTagsChange([...selectedTags, tag]);
  }

  function removeTag(tag: string) {
    onTagsChange(selectedTags.filter((selectedTag) => selectedTag !== tag));
  }

  return (
    <section className="search-panel">
      <div className="field">
        <label htmlFor="mental-search">Intenção Mental</label>
        <input
          id="mental-search"
          type="search"
          placeholder="Ex.: costumava, acostumado, e se..."
          value={mentalSearch}
          onChange={(event) => onMentalSearchChange(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="english-search">English</label>
        <input
          id="english-search"
          type="search"
          placeholder="Ex.: used to, getting used to..."
          value={englishSearch}
          onChange={(event) => onEnglishSearchChange(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="category-search">Categoria</label>
        <input
          id="category-search"
          type="search"
          placeholder="Ex.: questions, habits, conditions..."
          value={categorySearch}
          onChange={(event) => onCategorySearchChange(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="english-level-search">Nível</label>
        <select
          id="english-level-search"
          value={englishLevelSearch}
          onChange={(event) =>
            onEnglishLevelSearchChange(event.target.value)
          }
        >
          <option value="">Todos</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>
      </div>

      <div className="field tag-filter-field">
        <label htmlFor="tag-select">Tags</label>

        <select
          id="tag-select"
          value=""
          onChange={(event) => addTag(event.target.value)}
          disabled={remainingTags.length === 0}
        >
          <option value="">
            {remainingTags.length > 0
              ? "Selecione uma tag..."
              : "Todas as tags selecionadas"}
          </option>

          {remainingTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        {selectedTags.length > 0 && (
          <div className="selected-tags">
            {selectedTags.map((tag) => (
              <button
                type="button"
                className="selected-tag"
                key={tag}
                onClick={() => removeTag(tag)}
                title={`Remover tag ${tag}`}
              >
                {tag}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="secondary-button"
        onClick={onClear}
        disabled={!hasFilters}
      >
        Limpar filtros
      </button>
    </section>
  );
}

interface SearchPanelProps {
  mentalSearch: string;
  englishSearch: string;
  categorySearch: string;
  onMentalSearchChange: (value: string) => void;
  onEnglishSearchChange: (value: string) => void;
  onCategorySearchChange: (value: string) => void;
  onClear: () => void;
}

export function SearchPanel({
  mentalSearch,
  englishSearch,
  categorySearch,
  onMentalSearchChange,
  onEnglishSearchChange,
  onCategorySearchChange,
  onClear
}: SearchPanelProps) {
  const hasFilters = Boolean(mentalSearch || englishSearch || categorySearch);

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

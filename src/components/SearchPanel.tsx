interface SearchPanelProps {
  mentalSearch: string;
  englishSearch: string;
  onMentalSearchChange: (value: string) => void;
  onEnglishSearchChange: (value: string) => void;
  onClear: () => void;
}

export function SearchPanel({
  mentalSearch,
  englishSearch,
  onMentalSearchChange,
  onEnglishSearchChange,
  onClear
}: SearchPanelProps) {
  const hasFilters = Boolean(mentalSearch || englishSearch);

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

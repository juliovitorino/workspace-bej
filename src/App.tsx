import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Header } from "./components/Header";
import { SearchPanel } from "./components/SearchPanel";
import { IntentionList } from "./components/IntentionList";
import { IntentionDetails } from "./components/IntentionDetails";
import { fetchHashmap, loadHashmap } from "./services/hashmapService";
import type { HashmapData, MentalIntention } from "./types/hashmap";
import { searchIntentions } from "./utils/searchIntentions";

function App() {
  const [data, setData] = useState<HashmapData | null>(null);
  const [source, setSource] = useState<"remote" | "cache">("remote");
  const [mentalSearch, setMentalSearch] = useState("");
  const [englishSearch, setEnglishSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<MentalIntention | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError(null);

      try {
        const result = await loadHashmap();
        if (!active) return;

        setData(result.data);
        setSource(result.source);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o Mental Hashmap."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

  const availableTags = useMemo(() => {
    if (!data) return [];

    return Array.from(
      new Set(
        data.mentalMap.flatMap((item) => item.tags ?? [])
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!data) return [];

    return searchIntentions(
      data.mentalMap,
      mentalSearch,
      englishSearch,
      categorySearch,
      selectedTags
    );
  }, [data, mentalSearch, englishSearch, categorySearch, selectedTags]);

  async function retry() {
    setRetrying(true);
    setError(null);

    try {
      const remoteData = await fetchHashmap();
      setData(remoteData);
      setSource("remote");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o Mental Hashmap."
      );
    } finally {
      setRetrying(false);
    }
  }

  function clearFilters() {
    setMentalSearch("");
    setEnglishSearch("");
    setCategorySearch("");
    setSelectedTags([]);
  }

  return (
    <main className="page-shell">
      <div className="container">
        <Header metadata={data?.metadata} source={data ? source : undefined} />

        {loading && (
          <div className="status-card">
            <div className="spinner" />
            <p>Carregando Mental Hashmap...</p>
          </div>
        )}

        {!loading && error && !data && (
          <div className="status-card error-card">
            <h2>Não foi possível carregar o Mental Hashmap.</h2>
            <p>{error}</p>
            <button
              className="primary-button"
              type="button"
              onClick={retry}
              disabled={retrying}
            >
              {retrying ? "Tentando novamente..." : "Tentar novamente"}
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            {source === "cache" && (
              <div className="warning-banner">
                Não foi possível acessar a fonte externa. Exibindo a última versão
                salva localmente.
                <button
                  type="button"
                  onClick={retry}
                  disabled={retrying}
                >
                  {retrying ? "Atualizando..." : "Tentar atualizar"}
                </button>
              </div>
            )}

            <SearchPanel
              mentalSearch={mentalSearch}
              englishSearch={englishSearch}
              categorySearch={categorySearch}
              availableTags={availableTags}
              selectedTags={selectedTags}
              onMentalSearchChange={setMentalSearch}
              onEnglishSearchChange={setEnglishSearch}
              onCategorySearchChange={setCategorySearch}
              onTagsChange={setSelectedTags}
              onClear={clearFilters}
            />

            <section className="results-header">
              <div>
                <p className="eyebrow">Resultados</p>
                <h2>
                  {filteredItems.length}{" "}
                  {filteredItems.length === 1 ? "intenção" : "intenções"}
                </h2>
              </div>

              <p>
                Total disponível: <strong>{data.mentalMap.length}</strong>
              </p>
            </section>

            <IntentionList
              items={filteredItems}
              onSelect={setSelected}
            />
          </>
        )}
      </div>

      <IntentionDetails
        item={selected}
        allItems={data?.mentalMap ?? []}
        onClose={() => setSelected(null)}
        onSelectRelated={setSelected}
      />
    </main>
  );
}

export default App;

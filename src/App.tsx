import { readStudyStore } from "./features/study/studyStorage";
import { BackupReminderDialog } from "./components/BackupReminderDialog";
import { backupReminder, BACKUP_REMINDER_CHANGED } from "./utils/backupReminder";
import { AppSettingsPage } from "./components/AppSettingsPage";
import { StudyDashboard } from "./features/study/StudyDashboard";
import { ExtraActivities } from "./features/study/ExtraActivities";
import { useExtraActivity } from "./features/study/useExtraActivity";
import { effectiveStudyView, useStudyTracking, type StudySignal } from "./features/study/useStudyTracking";
import { t } from "./i18n";
import { useTranslation } from "react-i18next";
import { getSourceLanguage, getStudentLanguage, SOURCE_LANGUAGE_KEY, STUDENT_LANGUAGE_KEY, type SourceLanguage, type StudentLanguage } from "./config/languages";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { syncSourceLanguage } from "./i18n";
import "./App.css";
import { AppSettingsDialog } from "./components/AppSettingsDialog";
import { Header } from "./components/Header";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { DesktopScrollToTopButton } from "./components/DesktopScrollToTopButton";
import { SearchPanel, type ChunkFilter, type HqImageFilter, type YoutubeFilter } from "./components/SearchPanel";
import { Sidebar, type AppView } from "./components/Sidebar";
import { ExercisePanel } from "./components/ExercisePanel";
import { BasicTraining } from "./components/BasicTraining";
import { AdvancedTraining } from "./components/AdvancedTraining";
import { ReviewTraining } from "./components/ReviewTraining";
import { InterpretationPanel } from "./components/InterpretationPanel";
import { IntentionList } from "./components/IntentionList";
import { IntentionDetails } from "./components/IntentionDetails";
import { SpeakingGame } from "./components/SpeakingGame";
import { MemoryFlashcards } from "./components/MemoryFlashcards";
import { PersonalFlashcards } from "./features/personal-flashcards/PersonalFlashcards";
import { PERSONAL_CARDS_CHANGED, countPersonalFlashcards } from "./features/personal-flashcards/personalFlashcardStorage";
import { ChunkFlashcards } from "./components/ChunkFlashcards";
import { StoryShadowing } from "./components/StoryShadowing";
import { fetchHashmap, loadHashmap } from "./services/hashmapService";
import type { HashmapData, MentalIntention } from "./types/hashmap";
import { normalizeText } from "./utils/normalizeText";
import { searchIntentions } from "./utils/searchIntentions";
import { isAuthorMode } from "./utils/authorMode";
import { useAppTheme } from "./hooks/useAppTheme";
import { useFavoriteChunks } from "./hooks/useFavoriteChunks";
import { favoriteStudyItems } from "./utils/favoriteStudyItems";

type TrainingMode = "basic" | "advanced" | "review" | null;

function App() {
  const { t } = useTranslation();
  const { theme, changeTheme } = useAppTheme();
  const [language, setLanguage] = useState<StudentLanguage>(getStudentLanguage);
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>(getSourceLanguage);
  useLayoutEffect(() => { syncSourceLanguage(sourceLanguage); }, [sourceLanguage]);
  const [settingsDialog, setSettingsDialog] = useState<"languages" | "about" | null>(null);
  const [walkingActive, setWalkingActive] = useState(false);
  const requestVersion = useRef(0);
  const [data, setData] = useState<HashmapData | null>(null);
  const { favorites, toggleFavorite, storageError: favoriteStorageError } = useFavoriteChunks();
  const favoriteChunkCount = useMemo(() => favoriteStudyItems(data?.metadata.language === language ? data.mentalMap : [], favorites, language, "all").length,
  [data, favorites, language]);
  const [source, setSource] = useState<"remote" | "cache">("remote");
  const [dashboardSection, setDashboardSection] = useState<"settings" | "history" | undefined>();
  const [currentView, commitView] = useState<AppView>("study-dashboard");
  const [backupReminderOpen, setBackupReminderOpen] = useState(false);
  const pendingBackupNavigation = useRef<(() => void) | null>(null);
  function requestStudyNavigation(proceed: () => void) {
    if (backupReminder.due()) {
      pendingBackupNavigation.current = proceed;
      setBackupReminderOpen(true);
    } else proceed();
  }
  function setCurrentView(view: AppView) {
    if (view === "settings" || view === "study-dashboard") commitView(view);
    else requestStudyNavigation(() => commitView(view));
  }
  function continueAfterBackup() {
    setBackupReminderOpen(false);
    const proceed = pendingBackupNavigation.current;
    pendingBackupNavigation.current = null;
    proceed?.();
  }
  const reminderContext = useRef({ currentView, walkingActive });
  reminderContext.current = { currentView, walkingActive };
  useEffect(() => {
    if (backupReminder.due()) setBackupReminderOpen(true);
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (!backupReminder.due()) {
        // Another tab may have exported or postponed while this dialog was open.
        continueAfterBackup();
        return;
      }
      const context = reminderContext.current;
      // Resume checks never interrupt an open study module, audio or timed activity.
      if (!context.walkingActive && ["settings", "study-dashboard"].includes(context.currentView)) {
        try { if (readStudyStore().extraActivity?.state === "running") return; } catch { return; }
        setBackupReminderOpen(true);
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener(BACKUP_REMINDER_CHANGED, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BACKUP_REMINDER_CHANGED, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const [personalCount, setPersonalCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void countPersonalFlashcards().then(count => {
        if (active) setPersonalCount(count);
      }).catch(() => { if (active) setPersonalCount(0); });
    };
    refresh();
    window.addEventListener(PERSONAL_CARDS_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(PERSONAL_CARDS_CHANGED, refresh); };
  }, []);
  useEffect(() => {
    if (personalCount === 0 && currentView === "personal-flashcards") setCurrentView("memory-flashcards");
  }, [personalCount, currentView]);
  const [filterScrollRequest, setFilterScrollRequest] = useState(0);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const [mentalSearch, setMentalSearch] = useState("");
  const [englishSearch, setEnglishSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [englishLevelSearch, setEnglishLevelSearch] = useState("");
  const [hqImageFilter, setHqImageFilter] = useState<HqImageFilter>("all");
  const [chunkFilter, setChunkFilter] = useState<ChunkFilter>("all");
  const [youtubeVideoFilter, setYoutubeVideoFilter] = useState<YoutubeFilter>("all");
  const [youtubeShortFilter, setYoutubeShortFilter] = useState<YoutubeFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<MentalIntention | null>(null);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>(null);
  const [trainingIntention, setTrainingIntention] = useState<MentalIntention | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studySignal, setStudySignal] = useState<StudySignal | null>(null);
  const reportStudy = useCallback((active: boolean, mode: "manual" | "walking" = "manual", activeUntil?: number) => {
    setStudySignal(previous => previous?.view === currentView && previous.language === language && previous.active === active && previous.mode === mode && previous.activeUntil === activeUntil
      ? previous : { view: currentView, language, active, mode, activeUntil });
  }, [currentView, language]);
  const [trainingSignal, setTrainingSignal] = useState<StudySignal | null>(null);
  const studyView = effectiveStudyView(currentView, trainingMode);
  const reportTraining = useCallback((active: boolean, mode: "manual" | "walking" = "manual", activeUntil?: number) => {
    setTrainingSignal({ view: studyView, language, active, mode, activeUntil });
  }, [studyView, language]);
  const extraActivity = useExtraActivity();
  const studyWarning = useStudyTracking(studyView, language, trainingMode ? trainingSignal : studySignal,
    backupReminderOpen || !!settingsDialog || (studyView !== "shadowing" && (loading || !data)));

  // Mesma verificacao de modo autor usada pelas ferramentas existentes.
  const authorMode = isAuthorMode();

  useEffect(() => {
    if (!filterScrollRequest || currentView !== "hashmap" || loading || !data || trainingMode) return;
    const frame = window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 820px)").matches) {
        (filtersVisible ? document.getElementById("hashmap-search-filters") : resultsRef.current)?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
        });
      }
      setFilterScrollRequest(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filterScrollRequest, filtersVisible, currentView, loading, data, trainingMode]);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;

    async function initialize() {
      setLoading(true);
      setError(null);

      try {
        const result = await loadHashmap(language, sourceLanguage);
        if (!active || version !== requestVersion.current) return;

        setData(result.data);
        setSource(result.source);
      } catch (err) {
        if (!active || version !== requestVersion.current) return;
        setError(
          err instanceof Error
            ? err.message
            : t("app.couldNotLoadMentalHashmap")
        );
      } finally {
        if (active && version === requestVersion.current) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [language, sourceLanguage]);

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

    const searchedItems = searchIntentions(
      data.mentalMap,
      mentalSearch,
      englishSearch,
      categorySearch,
      selectedTags,
      englishLevelSearch,
      sourceLanguage
    );

    return searchedItems.filter((item) => {
      if (chunkFilter !== "all") {
        const isChunk = item.allowLanguageChunkPractice === true;
        if (chunkFilter === "with" && !isChunk) return false;
        if (chunkFilter === "without" && isChunk) return false;
      }

      // Entre os filtros de YouTube selecionados, aplica OU (OR).
      // "all" é neutro: não participa da combinação.
      // Os demais filtros de busca continuam combinados com E (AND).
      if (authorMode && (youtubeVideoFilter !== "all" || youtubeShortFilter !== "all")) {
        const hasYoutubeVideo = typeof item.youtubeVideo === "string" && item.youtubeVideo.trim().length > 0;
        const hasYoutubeShort = typeof item.youtubeShort === "string" && item.youtubeShort.trim().length > 0;

        const matchesVideo = youtubeVideoFilter !== "all" &&
          (youtubeVideoFilter === "with" ? hasYoutubeVideo : !hasYoutubeVideo);
        const matchesShort = youtubeShortFilter !== "all" &&
          (youtubeShortFilter === "with" ? hasYoutubeShort : !hasYoutubeShort);

        if (!matchesVideo && !matchesShort) return false;
      }

      if (hqImageFilter !== "all") {
        const hasHqImage = (item.examples ?? []).some(
          (example) =>
            typeof example.hqImage === "string" &&
            example.hqImage.trim().length > 0
        );
        if (hqImageFilter === "with" && !hasHqImage) return false;
        if (hqImageFilter === "without" && hasHqImage) return false;
      }

      return true;
    });
  }, [
    data,
    mentalSearch,
    englishSearch,
    categorySearch,
    selectedTags,
    englishLevelSearch,
    sourceLanguage,
    hqImageFilter,
    chunkFilter,
    authorMode,
    youtubeVideoFilter,
    youtubeShortFilter
  ]);

  async function retry() {
    const version = ++requestVersion.current;
    setRetrying(true);
    setError(null);

    try {
      const remoteData = await fetchHashmap(language, sourceLanguage);
      if (version !== requestVersion.current) return;
      setData(remoteData);
      setSource("remote");
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(
        err instanceof Error
          ? err.message
          : t("app.couldNotLoadMentalHashmap")
      );
    } finally {
      if (version === requestVersion.current) {
        setRetrying(false);
        setLoading(false);
      }
    }
  }

  function changeLanguage(nextLanguage: StudentLanguage) {
    if (walkingActive) return;
    if (nextLanguage === language) return;
    ++requestVersion.current;
    if (nextLanguage === sourceLanguage) {
      setSourceLanguage(language); // Troca automaticamente origem e estudo.
      try { localStorage.setItem(SOURCE_LANGUAGE_KEY, language); } catch { /* Storage optional. */ }
    }
    setLanguage(nextLanguage);
    try { localStorage.setItem(STUDENT_LANGUAGE_KEY, nextLanguage); } catch { /* Storage may be unavailable. */ }
    setData(null);
    setSelected(null);
    closeTraining();
    clearFilters();
    setLoading(true);
    setRetrying(false);
    setError(null);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function changeSourceLanguage(nextSource: SourceLanguage) {
    if (walkingActive || nextSource === sourceLanguage) return;
    ++requestVersion.current;
    if (nextSource === language) {
      setLanguage(sourceLanguage); // Troca automaticamente origem e estudo.
      try { localStorage.setItem(STUDENT_LANGUAGE_KEY, sourceLanguage); } catch { /* Storage optional. */ }
    }
    setSourceLanguage(nextSource);
    try { localStorage.setItem(SOURCE_LANGUAGE_KEY, nextSource); } catch { /* Storage optional. */ }
    setData(null);
    setSelected(null);
    closeTraining();
    clearFilters();
    setLoading(true);
    setRetrying(false);
    setError(null);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function clearFilters() {
    setMentalSearch("");
    setEnglishSearch("");
    setCategorySearch("");
    setEnglishLevelSearch("");
    setHqImageFilter("all");
    setChunkFilter("all");
    setYoutubeVideoFilter("all");
    setYoutubeShortFilter("all");
    setSelectedTags([]);
  }

  function startTraining(
    item: MentalIntention,
    mode: Exclude<TrainingMode, null>
  ) {
    requestStudyNavigation(() => {
      setTrainingIntention(item);
      setTrainingMode(mode);
      setSelected(null);
    });
  }

  function closeTraining() {
    setTrainingMode(null);
    setTrainingIntention(null);
  }

  return (
    <main className="app-layout">
      {backupReminderOpen && <BackupReminderDialog onContinue={continueAfterBackup}
        onDismiss={() => { backupReminder.dismiss(); continueAfterBackup(); }} />}
      <Sidebar
        theme={theme}
        onThemeChange={changeTheme}
        onOpenLanguages={() => setSettingsDialog("languages")}
        onOpenAbout={() => setSettingsDialog("about")}
        currentView={currentView}
        personalCount={personalCount}
        favoriteChunkCount={favoriteChunkCount}
        onViewChange={view => {
          const navigate = () => {
            setDashboardSection(undefined);
            if (view === "hashmap" && window.matchMedia("(max-width: 820px)").matches) {
              closeTraining();
              setSelected(null);
              window.speechSynthesis?.cancel();
              setFilterScrollRequest(request => request + 1);
            } else {
              setFilterScrollRequest(0);
            }
            if (view === "settings" || view === "shadowing" || view === "favorite-chunks" || view === "study-dashboard" || view === "extra-activities") {
              closeTraining();
              setSelected(null);
              window.speechSynthesis?.cancel();
            }
            commitView(view);
          };
          if (view === "settings" || view === "study-dashboard") navigate();
          else requestStudyNavigation(navigate);
        }}
      />

      <div className="app-content">
        <div className="page-shell">
          <div className="container">
            <Header language={language} sourceLanguage={sourceLanguage} onOpenLanguages={() => setSettingsDialog("languages")} />
            {settingsDialog && <AppSettingsDialog
              kind={settingsDialog}
              language={language}
              sourceLanguage={sourceLanguage}
              languageLocked={walkingActive}
              onLanguageChange={changeLanguage}
              onSourceLanguageChange={changeSourceLanguage}
              metadata={data?.metadata}
              source={data ? source : undefined}
              onClose={() => setSettingsDialog(null)}
            />}
            {studyWarning && (studyWarning !== "compatibility" || currentView === "study-dashboard") && <p className="warning-banner" role="status">{t(`study.warning.${studyWarning}`)}</p>}
            {currentView === "settings" && <AppSettingsPage
              language={language} sourceLanguage={sourceLanguage} languageLocked={walkingActive}
              onLanguageChange={changeLanguage} onSourceLanguageChange={changeSourceLanguage}
              theme={theme} onThemeChange={changeTheme}
              onOpenStudy={() => setCurrentView("chunk-flashcards")}
              onOpenData={section => { setDashboardSection(section); setCurrentView("study-dashboard"); }}
            />}
            {currentView === "study-dashboard" && <StudyDashboard language={language} initialSection={dashboardSection} />}
            {extraActivity.draft && currentView !== "extra-activities" && <p className="warning-banner" role="status">{t("extras.activeNotice")} <button type="button" className="secondary-button" onClick={() => { closeTraining(); setSelected(null); setCurrentView("extra-activities"); }}>{t("extras.open")}</button></p>}
            {currentView === "extra-activities" && <ExtraActivities language={language} state={extraActivity} />}
            {currentView === "shadowing" && <StoryShadowing key={`${sourceLanguage}-${language}`} language={language} onStudyState={reportStudy} onMenu={() => setCurrentView("hashmap")} />}

        {loading && currentView !== "shadowing" && currentView !== "study-dashboard" && currentView !== "extra-activities" && currentView !== "settings" && (
          <div className="status-card">
            <div className="spinner" />
            <p>{t("app.loadingMentalHashmap")}</p>
          </div>
        )}

        {!loading && error && !data && currentView !== "shadowing" && currentView !== "study-dashboard" && currentView !== "extra-activities" && currentView !== "settings" && (
          <div className="status-card error-card">
            <h2>{t("app.couldNotLoadMentalHashmap")}</h2>
            <p>{error}</p>
            <button
              className="primary-button"
              type="button"
              onClick={retry}
              disabled={retrying}
            >
              {retrying ? t("app.tryingAgain") : t("app.tryAgain")}
            </button>
          </div>
        )}

            {!loading && data && currentView === "hashmap" && !trainingMode && (
              <>
                {source === "cache" && (
              <div className="warning-banner">
                
                {t("app.couldNotAccessTheExternalSourceShowingTheLatestVersion")}
                <button
                  type="button"
                  onClick={retry}
                  disabled={retrying}
                >
                  {retrying ? t("app.updating") : t("app.checkForUpdates")}
                </button>
              </div>
            )}

            <SearchPanel
              mobileCollapsed={!filtersVisible}
              sourceLanguage={sourceLanguage}
              language={language}
              mentalSearch={mentalSearch}
              englishSearch={englishSearch}
              categorySearch={categorySearch}
              englishLevelSearch={englishLevelSearch}
              hqImageFilter={hqImageFilter}
              chunkFilter={chunkFilter}
              isAuthor={authorMode}
              youtubeVideoFilter={youtubeVideoFilter}
              youtubeShortFilter={youtubeShortFilter}
              availableTags={availableTags}
              selectedTags={selectedTags}
              onMentalSearchChange={setMentalSearch}
              onEnglishSearchChange={setEnglishSearch}
              onCategorySearchChange={setCategorySearch}
              onEnglishLevelSearchChange={setEnglishLevelSearch}
              onHqImageFilterChange={setHqImageFilter}
              onChunkFilterChange={setChunkFilter}
              onYoutubeVideoFilterChange={setYoutubeVideoFilter}
              onYoutubeShortFilterChange={setYoutubeShortFilter}
              onTagsChange={setSelectedTags}
              onClear={clearFilters}
            />

            <section ref={resultsRef} className="results-header hashmap-results-header">
              <div>
                <p className="eyebrow">{t("app.results")}</p>
                <h2>
                  {t("hashmap.results", { count: filteredItems.length })}
                </h2>
              </div>

              <p>
                {t("hashmap.totalAvailable", { count: data.mentalMap.length })}
              </p>
            </section>

                <IntentionList
                  items={filteredItems}
                  filters={{ englishLevelSearch, categorySearch, selectedTags,
                    onLevelToggle: level => setEnglishLevelSearch(current => normalizeText(current) === normalizeText(level) ? "" : level),
                    onCategoryToggle: category => setCategorySearch(current => normalizeText(current) === normalizeText(category) ? "" : category),
                    onTagToggle: tag => setSelectedTags(current => current.some(value => normalizeText(value) === normalizeText(tag))
                      ? current.filter(value => normalizeText(value) !== normalizeText(tag)) : [...current, tag])
                  }}
                  favorites={favorites}
                  onToggleFavorite={(id, type) => toggleFavorite(id, language, type)}
                  sourceLanguage={sourceLanguage}
                  language={language}
                  onSelect={setSelected}
                />
              </>
            )}

            {!loading && data && currentView === "exercises" && !trainingMode && (
              <ExercisePanel
                intentions={data.mentalMap}
                onStartTraining={startTraining}
              />
            )}

            {favoriteStorageError && <p role="alert">{t("favorites.storageError")}</p>}
            {!loading && data && (currentView === "chunk-flashcards" || currentView === "favorite-chunks") && (
              <div style={{ display: trainingMode ? "none" : undefined }}>
                <ChunkFlashcards
                  onStudyState={reportStudy}
                  sourceLanguage={sourceLanguage}
                  key={`${sourceLanguage}-${language}-${currentView}`}
                  mode={currentView === "favorite-chunks" ? "favorites" : "all"}
                  favorites={favorites}
                  onToggleFavorite={(id, type) => toggleFavorite(id, language, type)}
                  onBackToAll={() => setCurrentView("chunk-flashcards")}
                  language={language}
                  onWalkingChange={setWalkingActive}
                  intentions={data.mentalMap}
                  onShowDetails={setSelected}
                  onBasicTraining={(item) => startTraining(item, "basic")}
                  onAdvancedTraining={(item) => startTraining(item, "advanced")}
                />
              </div>
            )}

            {!loading && data && currentView === "memory-flashcards" && (
              <div style={{ display: trainingMode ? "none" : undefined }}>
                <MemoryFlashcards onStudyState={reportStudy} key={sourceLanguage + "-" + language}
                  favorites={favorites}
                  onToggleFavorite={(id, type) => toggleFavorite(id, language, type)}
                  intentions={data.mentalMap} language={language} sourceLanguage={sourceLanguage}
                  onShowDetails={setSelected}
                  onBasicTraining={item => startTraining(item, "basic")}
                  onAdvancedTraining={item => startTraining(item, "advanced")} />
              </div>
            )}

            {currentView === "personal-flashcards" && !trainingMode && (
              <PersonalFlashcards key={`${sourceLanguage}-${language}`}
                sourceLanguage={sourceLanguage} targetLanguage={language} />
            )}

            {!loading && currentView === "speaking-game" && !trainingMode && (
              <SpeakingGame onStudyState={reportStudy} key={`${sourceLanguage}-${language}`} language={language} sourceLanguage={sourceLanguage} />
            )}

            {currentView === "interpretation" &&
              !trainingMode && (
                <InterpretationPanel
                  onStudyState={reportStudy}
                  language={language}
                  sourceLanguage={sourceLanguage}
                  intentions={data?.mentalMap ?? []}
                  onSelectIntention={setSelected}
                />
              )}
            {!loading &&
              data &&
              trainingMode === "basic" &&
              trainingIntention && (
                <BasicTraining
                  onStudyState={reportTraining}
                  sourceLanguage={sourceLanguage}
                  language={language}
                  intention={trainingIntention}
                  onBack={closeTraining}
                />
              )}

            {!loading &&
              data &&
              trainingMode === "advanced" &&
              trainingIntention && (
                <AdvancedTraining
                  onStudyState={reportTraining}
                  language={language}
                  intention={trainingIntention}
                  onBack={closeTraining}
                />
              )}

            {!loading &&
              data &&
              trainingMode === "review" &&
              trainingIntention && (
                <ReviewTraining
                  onStudyState={reportTraining}
                  language={language}
                  intention={trainingIntention}
                  onBack={closeTraining}
                />
              )}
          </div>
        </div>
      </div>

      <IntentionDetails
        favorites={favorites}
        onToggleFavorite={(id, type) => toggleFavorite(id, language, type)}
        sourceLanguage={sourceLanguage}
        language={language}
        item={
          (
            currentView === "hashmap" ||
            currentView === "chunk-flashcards" ||
            currentView === "favorite-chunks" ||
            currentView === "memory-flashcards" ||
            currentView === "interpretation"
          ) &&
          !trainingMode
            ? selected
            : null
        }
        allItems={data?.mentalMap ?? []}
        onClose={() => setSelected(null)}
        onSelectRelated={setSelected}
        onBasicTraining={(item) => startTraining(item, "basic")}
        onAdvancedTraining={(item) => startTraining(item, "advanced")}
        onReviewTraining={(item) => startTraining(item, "review")}
      />
      <div id="app-floating-controls" className="mobile-floating-controls">
        {currentView === "hashmap" && !loading && data && !trainingMode &&
          Boolean(englishLevelSearch || categorySearch || selectedTags.length) && (
          <button type="button" className="hashmap-clear-card-filters"
            aria-label={t("filters.clearLevelCategoryTags")} title={t("filters.clearLevelCategoryTags")}
            onClick={() => {
              setEnglishLevelSearch("");
              setCategorySearch("");
              setSelectedTags([]);
              document.querySelector<HTMLButtonElement>("#app-floating-controls .hashmap-filter-toggle")?.focus({ preventScroll: true });
            }}>
            <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 3H4l6 7v9l4 2v-8M16 15l5 5m0-5-5 5" />
            </svg>
          </button>
        )}
        {currentView === "hashmap" && !loading && data && !trainingMode && (
          <button type="button" className="hashmap-filter-toggle"
            aria-label={t(filtersVisible ? "navigation.hideFilters" : "navigation.showFilters")}
            title={t(filtersVisible ? "navigation.hideFilters" : "navigation.showFilters")}
            aria-expanded={filtersVisible}
            aria-controls="hashmap-search-filters"
            onClick={() => {
              setFiltersVisible(visible => !visible);
              setFilterScrollRequest(request => request + 1);
            }}>
            <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
          </button>
        )}
        <ScrollToTopButton />
      </div>
      <DesktopScrollToTopButton active={currentView === "hashmap" && !selected && !trainingMode && !loading && !!data} />
    </main>
  );
}

export default App;

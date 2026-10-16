import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import {
  PERSONAL_CARDS_CHANGED, deletePersonalFlashcard,
  listPersonalFlashcards, type PersonalFlashcard
} from "./personalFlashcardStorage";
import { PersonalFlashcardEditor } from "./PersonalFlashcardEditor";
import { PersonalBackupMenu } from "./PersonalBackupMenu";
import "./personalFlashcards.css";

interface Props { sourceLanguage: StudentLanguage; targetLanguage: StudentLanguage; }
function shuffled(cards: PersonalFlashcard[]) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ImageOnCard({ image }: { image?: Blob }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!image) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(image);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  return url ? <img className="personal-card-image" src={url} alt="" /> : null;
}

export function PersonalFlashcards({ sourceLanguage, targetLanguage }: Props) {
  const { t } = useTranslation();
  const [allCards, setAllCards] = useState<PersonalFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PersonalFlashcard | "new" | null>(null);
  const [deck, setDeck] = useState<PersonalFlashcard[]>([]);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listPersonalFlashcards().then(cards => {
        if (active) { setAllCards(cards); setLoading(false); setError(""); }
      }).catch(() => {
        if (active) { setLoading(false); setError(t("personal.storageError")); }
      });
    };
    refresh();
    window.addEventListener(PERSONAL_CARDS_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(PERSONAL_CARDS_CHANGED, refresh); };
  }, [t]);

  const cards = useMemo(() => allCards.filter(card =>
    card.sourceLanguage === sourceLanguage && card.targetLanguage === targetLanguage
  ), [allCards, sourceLanguage, targetLanguage]);

  // A changed personal collection resets only this module's study deck.
  useEffect(() => {
    setDeck(shuffled(cards));
    setPosition(0);
    setFlipped(false);
    setReviewed(0);
  }, [cards]);

  const current = deck[position];
  const complete = deck.length > 0 && reviewed === deck.length;

  function next() {
    if (complete) {
      setDeck(shuffled(cards)); setPosition(0); setFlipped(false); setReviewed(0);
    } else if (reviewed > position) {
      setPosition(value => value + 1); setFlipped(false);
    }
  }
  function flip() {
    if (!current) return;
    if (!flipped && reviewed === position) setReviewed(value => value + 1);
    setFlipped(value => !value);
  }

  async function remove(card: PersonalFlashcard) {
    if (!window.confirm(t("personal.deleteConfirm"))) return;
    try { await deletePersonalFlashcard(card.id); } catch { setError(t("personal.storageError")); }
  }

  return <section className="personal-flashcards">
    <header className="personal-page-heading">
      <div><h2>🗂️ {t("personal.title")}</h2>
        <p>{LANGUAGES[sourceLanguage].flag} {sourceLanguage} → {LANGUAGES[targetLanguage].flag} {targetLanguage}</p>
      </div>
      <button type="button" className="primary-button" onClick={() => setEditing("new")}>+ {t("personal.create")}</button>
    </header>
    <p className="personal-note">{t("personal.localNotice")}</p>
    <div className="personal-management-row">
      <span>{t("personal.manageCards")}</span>
      <PersonalBackupMenu
        onStatus={message => { setImportMessage(message); setError(""); }}
        onError={message => { setError(message); setImportMessage(""); }}
      />
    </div>
    {importMessage && <p role="status">{importMessage}</p>}
    {error && <p role="alert" className="personal-error">{error}</p>}
    {loading ? <p>{t("personal.loading")}</p> : <>
      <p className="personal-count">{t("personal.count", { count: cards.length })}</p>
      {current ? <div className="personal-study">
        <div className="personal-study-progress">
          <span>{t("personal.studied", { count: reviewed, total: deck.length })}</span>
          <span>{Math.round(reviewed / deck.length * 100)}%</span>
        </div>
        <div className="memory-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reviewed / deck.length * 100)} aria-label={t("personal.progress")}>
          <div style={{ width: `${reviewed / deck.length * 100}%` }} />
        </div>
        <div className="personal-study-card" aria-live="polite">
          <small>{flipped ? LANGUAGES[targetLanguage].flag : LANGUAGES[sourceLanguage].flag} {flipped ? targetLanguage : sourceLanguage}</small>
          <h3 lang={flipped ? targetLanguage : sourceLanguage}>{flipped ? current.back : current.front}</h3>
          {flipped && current.context && <p className="personal-context">{current.context}</p>}
          {flipped && <ImageOnCard image={current.image} />}
        </div>
        <div className="personal-study-actions">
          <button type="button" className="primary-button" onClick={flip}>{flipped ? t("personal.showFront") : t("personal.flip")}</button>
          <button type="button" className="secondary-button" disabled={reviewed <= position && !complete} onClick={next}>{complete ? t("personal.newRound") : t("personal.next")}</button>
        </div>
      </div> : <p className="personal-empty">{t("personal.emptyPair")}</p>}
      {cards.length > 0 && <div className="personal-library">
        <h3>{t("personal.library")}</h3>
        {cards.map(card => <article key={card.id} className="personal-library-item">
          <div><strong>{card.front}</strong><p>{card.back}</p></div>
          <div className="personal-library-actions">
            <button type="button" className="secondary-button" onClick={() => setEditing(card)}>{t("personal.editAction")}</button>
            <button type="button" className="secondary-button" onClick={() => void remove(card)}>{t("personal.delete")}</button>
          </div>
        </article>)}
      </div>}
    </>}
    {editing && <PersonalFlashcardEditor
      sourceLanguage={sourceLanguage} targetLanguage={targetLanguage}
      existing={editing === "new" ? undefined : editing}
      onClose={() => setEditing(null)} onSaved={() => setEditing(null)}
    />}
  </section>;
}

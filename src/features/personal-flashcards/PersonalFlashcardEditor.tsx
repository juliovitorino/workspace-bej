import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type StudentLanguage } from "../../config/languages";
import { languageName } from "../../i18n";
import { MAX_IMAGE_BYTES, savePersonalFlashcard, type PersonalFlashcard } from "./personalFlashcardStorage";
import "./personalFlashcards.css";

interface Props {
  sourceLanguage: StudentLanguage;
  targetLanguage: StudentLanguage;
  onClose: () => void;
  onSaved: () => void;
  existing?: PersonalFlashcard;
}

export function PersonalFlashcardEditor({ sourceLanguage, targetLanguage, onClose, onSaved, existing }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [front, setFront] = useState(existing?.front ?? "");
  const [back, setBack] = useState(existing?.back ?? "");
  const [context, setContext] = useState(existing?.context ?? "");
  const [image, setImage] = useState<Blob | undefined>(existing?.image);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!image) { setPreview(null); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    frontRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), input:not(:disabled)'
        )).filter(element => element.getClientRects().length > 0);
        if (!elements.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, saving]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePersonalFlashcard({ sourceLanguage, targetLanguage, front, back, context, image }, existing);
      onSaved();
    } catch (cause: unknown) {
      // Preserve the localized message while exposing the real browser error.
      // This distinguishes IndexedDB failures from unsupported browser APIs.
      console.error("[BEJ] Failed to save personal flashcard:", cause);
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(detail ? `${t("personal.saveError")} (${detail})` : t("personal.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function chooseImage(file?: File) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("personal.imageError"));
      return;
    }
    setError("");
    setImage(file);
  }

  return <div className="personal-modal-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !saving) onClose();
  }}>
    <section ref={dialogRef} className="personal-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="personal-modal-header">
        <h2 id={titleId}>{t(existing ? "personal.edit" : "personal.create")}</h2>
        <button type="button" className="personal-icon-button" aria-label={t("common.close")} onClick={onClose} disabled={saving}>×</button>
      </header>
      <p className="personal-pair">
        <span>{LANGUAGES[sourceLanguage].flag} {languageName(sourceLanguage)}</span>
        <span aria-hidden="true">→</span>
        <span>{LANGUAGES[targetLanguage].flag} {languageName(targetLanguage)}</span>
      </p>
      <form onSubmit={submit} className="personal-form">
        <label>{t("personal.front")}
          <textarea ref={frontRef} required maxLength={500} rows={2} value={front} onChange={event => setFront(event.target.value)} />
        </label>
        <label>{t("personal.back")}
          <textarea required maxLength={500} rows={2} value={back} onChange={event => setBack(event.target.value)} />
        </label>
        <label>{t("personal.context")}
          <textarea maxLength={1500} rows={2} value={context} onChange={event => setContext(event.target.value)} />
        </label>
        <div className="personal-image-field">
          <span className="personal-field-label">{t("personal.imageShort")} <span className="personal-optional">{t("personal.optional")}</span></span>
          <input ref={imageInputRef} className="personal-visually-hidden" type="file"
            accept="image/jpeg,image/png,image/webp" aria-label={t("personal.addImage")}
            onChange={event => {
              chooseImage(event.target.files?.[0]);
              event.target.value = "";
            }} />
          {preview ? <div className="personal-image-preview">
            <img src={preview} alt={t("personal.imagePreview")} />
            <div className="personal-image-controls">
              <span className="personal-image-selected">{t("personal.imageSelected")}</span>
              <div>
                <button type="button" className="personal-text-action" onClick={() => imageInputRef.current?.click()} disabled={saving}>{t("personal.changeImage")}</button>
                <button type="button" className="personal-text-action" onClick={() => setImage(undefined)} disabled={saving}>{t("personal.removeImage")}</button>
              </div>
            </div>
          </div> : <button type="button" className="secondary-button personal-add-image"
            onClick={() => imageInputRef.current?.click()} disabled={saving}>＋ {t("personal.addImage")}</button>}
          <small className="personal-image-hint">{t("personal.imageHint")}</small>
        </div>
        {error && <p role="alert" className="personal-error">{error}</p>}
        <div className="personal-form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>{t("personal.cancel")}</button>
          <button type="submit" className="primary-button" disabled={saving || !front.trim() || !back.trim()}>
            {saving ? t("personal.saving") : t("personal.save")}
          </button>
        </div>
      </form>
    </section>
  </div>;
}

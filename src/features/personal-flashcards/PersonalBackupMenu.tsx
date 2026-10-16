import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportPersonalFlashcards, importPersonalFlashcards } from "./personalFlashcardStorage";

interface Props {
  restoreOnly?: boolean;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}

export function PersonalBackupMenu({ restoreOnly = false, onStatus, onError }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function restore(file?: File) {
    if (!file) return;
    setOpen(false);
    setBusy(true);
    try {
      const count = await importPersonalFlashcards(file);
      if (count === 0) onError(t("personal.emptyBackup"));
      else onStatus(t("personal.imported", { count }));
    } catch {
      onError(t("personal.importError"));
    } finally {
      setBusy(false);
    }
  }

  async function exportBackup() {
    setOpen(false);
    setBusy(true);
    try {
      await exportPersonalFlashcards();
    } catch {
      onError(t("personal.storageError"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="personal-backup-menu" ref={containerRef}>
    <button type="button" className="personal-backup-trigger" disabled={busy}
      aria-label={t("personal.backupMenu")} title={t("personal.backupMenu")}
      aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}>⋯</button>
    {open && <div className="personal-backup-dropdown" role="menu" aria-label={t("personal.backupMenu")}>
      {!restoreOnly && <button type="button" role="menuitem" onClick={() => void exportBackup()}>
        {t("personal.export")}
      </button>}
      <button type="button" role="menuitem" onClick={() => inputRef.current?.click()}>
        {t("personal.import")}
      </button>
    </div>}
    <input ref={inputRef} className="personal-visually-hidden" type="file" accept=".json,application/json"
      aria-label={t("personal.import")}
      onChange={event => {
        void restore(event.target.files?.[0]);
        event.target.value = "";
      }} />
  </div>;
}

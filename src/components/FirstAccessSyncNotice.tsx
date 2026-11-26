import { useEffect, useRef, useState } from "react";
import type { SourceLanguage } from "../config/languages";
import { STUDY_KEY } from "../features/study/studyStorage";

const NOTICE_KEY = "bej-first-access-sync-notice-dismissed-v1";

const copy = {
  "pt-BR": {
    title: "Bem-vindo ao BEJ! 🚀",
    message: "Já utiliza o Brazilian English Journey em outro dispositivo ou navegador?",
    detail: "Você pode recuperar seu progresso sincronizando os dados com a mesma pasta do Google Drive.",
    close: "Fechar"
  },
  "en-US": {
    title: "Welcome to BEJ! 🚀",
    message: "Already use Brazilian English Journey on another device or browser?",
    detail: "You can restore your progress by syncing with the same Google Drive folder.",
    close: "Close"
  },
  "es-ES": {
    title: "¡Bienvenido a BEJ! 🚀",
    message: "¿Ya utilizas Brazilian English Journey en otro dispositivo o navegador?",
    detail: "Puedes recuperar tu progreso sincronizando los datos con la misma carpeta de Google Drive.",
    close: "Cerrar"
  },
  "fr-FR": {
    title: "Bienvenue sur BEJ ! 🚀",
    message: "Vous utilisez déjà Brazilian English Journey sur un autre appareil ou navigateur ?",
    detail: "Vous pouvez retrouver votre progression en synchronisant les données avec le même dossier Google Drive.",
    close: "Fermer"
  }
} as const;

/** Detecta um contexto de estudo ainda sem dados; parâmetros do deep link não interferem. */
function shouldShowNotice(): boolean {
  try {
    if (localStorage.getItem(NOTICE_KEY) === "1") return false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STUDY_KEY) && (
        key.startsWith(STUDY_KEY + "session:") ||
        key.startsWith(STUDY_KEY + "adjustment:") ||
        key.startsWith(STUDY_KEY + "goal:") ||
        key.startsWith(STUDY_KEY + "active:")
      )) return false;
    }
    return true;
  } catch {
    // Storage indisponível não deve provocar uma mensagem enganosa.
    return false;
  }
}

export function FirstAccessSyncNotice({ language }: { language: SourceLanguage }) {
  const [open, setOpen] = useState(shouldShowNotice);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  const labels = copy[language] ?? copy["pt-BR"];
  const dismiss = () => {
    try { localStorage.setItem(NOTICE_KEY, "1"); } catch { /* Optional storage. */ }
    setOpen(false);
  };

  return <dialog ref={dialogRef} aria-labelledby="first-access-sync-title"
    aria-describedby="first-access-sync-message" onCancel={event => { event.preventDefault(); dismiss(); }}
    style={{
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      margin: 0, width: "min(92vw, 440px)", padding: "20px 24px",
      borderRadius: 16, textAlign: "center", background: "var(--surface, #132238)",
      color: "var(--text, #fff)", border: "2px solid #facc15",
      boxShadow: "0 12px 32px rgba(0,0,0,.24)", zIndex: 10002
    }}>
    <h2 id="first-access-sync-title" style={{ marginTop: 0, fontSize: "1.2rem" }}>{labels.title}</h2>
    <p id="first-access-sync-message">{labels.message}</p>
    <p>{labels.detail}</p>
    <button type="button" className="primary-button" onClick={dismiss}>{labels.close}</button>
  </dialog>;
}

import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import { isAuthorMode } from "../utils/authorMode";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** One source item per sentence/paragraph. Original text is never editable. */
export interface ConnectedSpeechBlock {
  original: string;
  portuguese?: string;
}

interface ConnectedSpeechButtonProps {
  title: string;
  blocks: ConnectedSpeechBlock[];
  label?: string;
  compact?: boolean;
}

const POPUP_STYLES = `
  :root {
    --page: #f5f7fb; --surface: #fff; --surface-soft: #eff6ff;
    --text: #152238; --muted: #64748b; --border: #dbe3ee;
    --border-strong: #cbd5e1; --accent: #2563eb;
    --accent-hover: #1d4ed8; --on-accent: #fff; --accent-border: #93c5fd;
    --shadow: #1522380a; color-scheme: light;
  }
  :root[data-theme="dark"] {
    --page: #0b1220; --surface: #172337; --surface-soft: #243657;
    --text: #eef3ff; --muted: #a8b8cf; --border: #33445e;
    --border-strong: #526680; --accent: #9bb4ff;
    --accent-hover: #bfd0ff; --on-accent: #101c32;
    --accent-border: #5e78ac; --shadow: #00000040; color-scheme: dark;
  }
  :root { font-family: Arial, Helvetica, sans-serif; color: var(--text); background: var(--page); }
  * { box-sizing: border-box; }
  body { margin: 0; }
  button, input { font: inherit; }
  button { cursor: pointer; }
  .studio-shell { max-width: 1500px; margin: auto; padding: 22px 30px 70px; }
  .studio-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .studio-head h1 { font-size: 25px; margin: 4px 0; }
  .studio-sub { color: var(--muted); font-size: 13px; margin: 0; }
  .studio-actions, .studio-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
  .studio-toolbar { position: sticky; top: 0; z-index: 10; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 18px 0; box-shadow: 0 3px 12px var(--shadow); }
  .studio-button { border: 1px solid var(--border-strong); background: white; color: var(--text); border-radius: 8px; padding: 8px 12px; min-height: 36px; }
  .studio-button:hover { background: var(--accent-soft); }
  .studio-button.primary { background: var(--accent); color: white; border-color: var(--accent); }
  .studio-button.primary:hover { background: var(--accent-hover); }
  .studio-divider { height: 27px; border-left: 1px solid var(--text-secondary); margin: 0 3px; }
  .studio-size { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
  .studio-size input { width: 66px; padding: 6px; border: 1px solid var(--border-strong); border-radius: 7px; }
  .studio-color { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
  .studio-color input { width: 33px; height: 31px; padding: 2px; cursor: pointer; }
  .studio-help { color: var(--muted); font-size: 12px; margin: 0 0 18px; }
  .studio-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0; break-inside: avoid; }
  .studio-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; min-width: 0; }
  .studio-card h2 { color: var(--muted); font-size: 12px; letter-spacing: .07em; text-transform: uppercase; margin: 0 0 12px; }
  .studio-original, .studio-editor { line-height: 1.55; overflow-wrap: anywhere; white-space: pre-wrap; min-height: 75px; }
  .studio-editor { border: 1px dashed var(--accent-border); border-radius: 8px; padding: 10px; outline-offset: 3px; }
  .studio-editor:focus { outline: 2px solid var(--accent); }
  .studio-pt { font-size: 12px; color: var(--muted); margin: 0 0 12px; }
  .studio-status { font-size: 13px; color: var(--accent-hover); min-height: 20px; }
  @media print { :root, :root[data-theme="dark"] { --page: white; --surface: white; --text: #152238; --muted: #64748b; --border: #ddd; color-scheme: light; } body { background: white; } .studio-shell { padding: 0; max-width: none; } .studio-actions, .studio-toolbar, .studio-help, .studio-status { display: none !important; } .studio-pair { break-inside: avoid; } .studio-card { border-color: #ddd; } .studio-editor { border: none; padding: 0; } @page { size: A4; margin: 13mm; } }
`;

function StudioWindow({ popup, title, blocks, onClose }: {
  popup: Window;
  title: string;
  blocks: ConnectedSpeechBlock[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [originalSize, setOriginalSize] = useState(24);
  const [connectedSize, setConnectedSize] = useState(26);
  const [status, setStatus] = useState("");
  const editorRefs = useRef<Array<HTMLDivElement | null>>([]);
  const selectionRef = useRef<Range | null>(null);
  const [revision, setRevision] = useState(0);

  function saveSelection() {
    const selection = popup.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editorRefs.current.some((editor) => editor?.contains(range.commonAncestorContainer))) {
      selectionRef.current = range.cloneRange();
    }
  }

  function format(command: string, value?: string) {
    const selection = popup.getSelection();
    if (selectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    popup.document.execCommand("styleWithCSS", false, "true");
    popup.document.execCommand(command, false, value);
    saveSelection();
  }

  function insertLinkingSymbol() {
    const selection = popup.getSelection();
    const savedRange = selectionRef.current;
    if (!selection || !savedRange) {
      setStatus(t("connectedSpeech.placeTheCursorInTheConnectedSpeechTextBeforeInserting"));
      return;
    }

    const editor = editorRefs.current.find((candidate) =>
      candidate?.contains(savedRange.commonAncestorContainer)
    );
    if (!editor) {
      setStatus(t("connectedSpeech.firstClickTheEditableConnectedSpeechText"));
      return;
    }

    const range = savedRange.cloneRange();
    // Se houver texto selecionado, insira o símbolo depois dele sem apagá-lo.
    range.collapse(false);
    const symbol = popup.document.createTextNode("‿");
    range.insertNode(symbol);
    range.setStartAfter(symbol);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
    editor.focus();
    setStatus(t("connectedSpeech.linkingSymbolInserted"));
  }

  function reset() {
    blocks.forEach((block, index) => {
      const editor = editorRefs.current[index];
      if (editor) editor.textContent = block.original;
    });
    selectionRef.current = null;
    setRevision((value) => value + 1);
    setStatus(t("connectedSpeech.editsRestoredFromTheOriginalEnglish"));
  }

  async function copy(rich: boolean) {
    const parts = blocks.map((block, index) => ({
      original: block.original,
      edited: editorRefs.current[index]?.innerText ?? block.original,
      html: editorRefs.current[index]?.innerHTML ?? ""
    }));
    const plain = parts.map((part) => `ORIGINAL EN-US\r\n${part.original}\r\n\r\nCONNECTED SPEECH\r\n${part.edited}`).join("\r\n\r\n");
    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const html = parts.map((part) => `<section style="margin-bottom:22px"><div style="font:600 12px Arial;color:#64748b">ORIGINAL EN-US</div><div style="font-size:${originalSize}px;white-space:pre-wrap">${escapeHtml(part.original)}</div><div style="font:600 12px Arial;color:#64748b;margin-top:12px">CONNECTED SPEECH</div><div style="font-size:${connectedSize}px;white-space:pre-wrap">${part.html}</div></section>`).join("");
    try {
      if (rich && popup.navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const ClipboardItemCtor = ClipboardItem;
        await popup.navigator.clipboard.write([new ClipboardItemCtor({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        })]);
      } else if (popup.navigator.clipboard?.writeText) {
        await popup.navigator.clipboard.writeText(plain);
      } else {
        const area = popup.document.createElement("textarea");
        area.value = plain;
        area.style.position = "fixed";
        area.style.left = "-9999px";
        popup.document.body.appendChild(area);
        area.select();
        const ok = popup.document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error(t("connectedSpeech.clipboardUnavailable"));
      }
      setStatus(rich ? t("connectedSpeech.contentCopiedWithFormattingWhenSupported") : t("connectedSpeech.plainTextCopied"));
    } catch {
      setStatus(t("connectedSpeech.couldNotCopyCheckClipboardPermissions"));
    }
  }

  return createPortal(
    <main className="studio-shell">
      <header className="studio-head">
        <div>
          <p className="studio-sub">BRAZILIAN ENGLISH JOURNEY · MENTAL HASHMAP</p>
          <h1>Connected Speech Studio</h1>
          <p className="studio-sub">{title}</p>
        </div>
        <div className="studio-actions">
          <button className="studio-button" onClick={() => void copy(false)}>{t("connectedSpeech.copyPlainText")}</button>
          <button className="studio-button primary" onClick={() => void copy(true)}>{t("connectedSpeech.copyFormattedText")}</button>
          <button className="studio-button" onClick={() => popup.print()}>{t("common.print")}</button>
          <button className="studio-button" onClick={() => { popup.close(); onClose(); }}>{t("common.close")}</button>
        </div>
      </header>
      <div className="studio-toolbar">
        <label className="studio-size">{t("connectedSpeech.originalPx")}
          <input type="number" min="14" max="72" step="2" value={originalSize} onChange={(event) => setOriginalSize(Math.max(14, Math.min(72, Number(event.target.value) || 14)))} />
        </label>
        <label className="studio-size">{t("connectedSpeech.connectedSpeechPx")}
          <input type="number" min="14" max="72" step="2" value={connectedSize} onChange={(event) => setConnectedSize(Math.max(14, Math.min(72, Number(event.target.value) || 14)))} />
        </label>
        <span className="studio-divider" />
        <button className="studio-button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} title={t("connectedSpeech.bold")}><b>B</b></button>
        <button className="studio-button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")} title={t("connectedSpeech.underline")}><u>U</u></button>
        <button className="studio-button" onMouseDown={(event) => event.preventDefault()} onClick={insertLinkingSymbol} title={t("connectedSpeech.insertLinkingSymbolAtTheCursor")} aria-label={t("connectedSpeech.insertLinkingSymbol")}>{t("connectedSpeech.linking")}</button>
        <label className="studio-color" title={t("connectedSpeech.selectedTextColor")}>{t("connectedSpeech.text")}
          <input type="color" defaultValue="#2563eb" onChange={(event) => format("foreColor", event.target.value)} />
        </label>
        <label className="studio-color" title={t("connectedSpeech.selectedTextHighlight")}>{t("connectedSpeech.highlighter")}
          <input type="color" defaultValue="#fde68a" onChange={(event) => format("hiliteColor", event.target.value)} />
        </label>
        <span className="studio-divider" />
        <button className="studio-button" onClick={reset}>{t("connectedSpeech.resetEdits")}</button>
      </div>
      <p className="studio-help">{t("connectedSpeech.placeTheCursorBetweenWordsAndClickLinkingToInsert")}</p>
      <p className="studio-status" role="status">{status}</p>
      {blocks.map((block, index) => (
        <section className="studio-pair" key={`${revision}-${index}`}>
          <div className="studio-card">
            <h2>{t("connectedSpeech.originalEnUs")} {index + 1}</h2>
            {block.portuguese && <p className="studio-pt">{block.portuguese}</p>}
            <div className="studio-original" style={{ fontSize: originalSize }}>{block.original}</div>
          </div>
          <div className="studio-card">
            <h2>{t("connectedSpeech.connectedSpeechEditable")}</h2>
            <div
              className="studio-editor"
              ref={(node) => { editorRefs.current[index] = node; }}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onMouseUp={saveSelection}
              onKeyUp={saveSelection}
              onInput={saveSelection}
              style={{ fontSize: connectedSize }}
              aria-label={t("connectedSpeech.editConnectedSpeechForPassageNumber", { number: (index + 1) })}
            >{block.original}</div>
          </div>
        </section>
      ))}
    </main>,
    popup.document.body
  );
}

export function ConnectedSpeechButton({ title, blocks, label = "Connected Speech", compact = false }: ConnectedSpeechButtonProps) {
  const { t } = useTranslation();
  const [desktop, setDesktop] = useState(false);
  const [popup, setPopup] = useState<Window | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!popup) return;
    const handleClose = () => setPopup(null);
    popup.addEventListener("beforeunload", handleClose);
    const observer = new MutationObserver(() => {
      if (popup.closed) return;
      popup.document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "light";
      popup.document.documentElement.style.colorScheme = document.documentElement.style.colorScheme;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => {
      observer.disconnect();
      popup.removeEventListener("beforeunload", handleClose);
      if (!popup.closed) popup.close();
    };
  }, [popup]);

  if (!desktop || blocks.length === 0 || !isAuthorMode()) return null;

  function openStudio() {
    if (!isAuthorMode()) return;
    if (popup && !popup.closed) { popup.focus(); return; }
    const newWindow = window.open("", "_blank");
    if (!newWindow) { setError(t("connectedSpeech.yourBrowserBlockedTheNewTabAllowPopUpsFor")); return; }
    newWindow.document.title = `Connected Speech Studio — ${title}`;
    // The studio opens in a separate document: mirror the current appearance.
    newWindow.document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "light";
    newWindow.document.documentElement.style.colorScheme = document.documentElement.style.colorScheme;

    const style = newWindow.document.createElement("style");
    style.textContent = POPUP_STYLES;
    newWindow.document.head.appendChild(style);
    newWindow.focus();
    setError("");
    setPopup(newWindow);
  }

  return <>
    <button type="button" className="secondary-button" onClick={openStudio}
      title={t("connectedSpeech.openConnectedSpeechStudioInANewTab")} aria-label={t("connectedSpeech.connectedSpeechTitle", { title: (title) })}
      style={compact ? { width: "2.5rem", minWidth: "2.5rem", height: "2.5rem", minHeight: "2.5rem", padding: 0, borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center" } : undefined}>
      <span aria-hidden="true">🎧</span>{!compact && <> {label} ↗</>}
    </button>
    {error && <span role="alert" style={{ color: "var(--bad)", fontSize: "0.8rem" }}>{error}</span>}
    {popup && !popup.closed && <StudioWindow popup={popup} title={title} blocks={blocks} onClose={() => setPopup(null)} />}
  </>;
}

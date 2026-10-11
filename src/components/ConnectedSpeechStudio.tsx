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
  :root { font-family: Arial, Helvetica, sans-serif; color: #152238; background: #f5f7fb; }
  * { box-sizing: border-box; }
  body { margin: 0; }
  button, input { font: inherit; }
  button { cursor: pointer; }
  .studio-shell { max-width: 1500px; margin: auto; padding: 22px 30px 70px; }
  .studio-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .studio-head h1 { font-size: 25px; margin: 4px 0; }
  .studio-sub { color: #64748b; font-size: 13px; margin: 0; }
  .studio-actions, .studio-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
  .studio-toolbar { position: sticky; top: 0; z-index: 10; background: #fff; border: 1px solid #dbe3ee; border-radius: 12px; padding: 12px; margin: 18px 0; box-shadow: 0 3px 12px #1522380a; }
  .studio-button { border: 1px solid #cbd5e1; background: white; color: #152238; border-radius: 8px; padding: 8px 12px; min-height: 36px; }
  .studio-button:hover { background: #eff6ff; }
  .studio-button.primary { background: #2563eb; color: white; border-color: #2563eb; }
  .studio-button.primary:hover { background: #1d4ed8; }
  .studio-divider { height: 27px; border-left: 1px solid #cbd5e1; margin: 0 3px; }
  .studio-size { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
  .studio-size input { width: 66px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 7px; }
  .studio-color { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
  .studio-color input { width: 33px; height: 31px; padding: 2px; cursor: pointer; }
  .studio-help { color: #64748b; font-size: 12px; margin: 0 0 18px; }
  .studio-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0; break-inside: avoid; }
  .studio-card { background: #fff; border: 1px solid #dbe3ee; border-radius: 12px; padding: 18px; min-width: 0; }
  .studio-card h2 { color: #64748b; font-size: 12px; letter-spacing: .07em; text-transform: uppercase; margin: 0 0 12px; }
  .studio-original, .studio-editor { line-height: 1.55; overflow-wrap: anywhere; white-space: pre-wrap; min-height: 75px; }
  .studio-editor { border: 1px dashed #93c5fd; border-radius: 8px; padding: 10px; outline-offset: 3px; }
  .studio-editor:focus { outline: 2px solid #2563eb; }
  .studio-pt { font-size: 12px; color: #64748b; margin: 0 0 12px; }
  .studio-status { font-size: 13px; color: #1d4ed8; min-height: 20px; }
  @media print { body { background: white; } .studio-shell { padding: 0; max-width: none; } .studio-actions, .studio-toolbar, .studio-help, .studio-status { display: none !important; } .studio-pair { break-inside: avoid; } .studio-card { border-color: #ddd; } .studio-editor { border: none; padding: 0; } @page { size: A4; margin: 13mm; } }
`;

function StudioWindow({ popup, title, blocks, onClose }: {
  popup: Window;
  title: string;
  blocks: ConnectedSpeechBlock[];
  onClose: () => void;
}) {
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
      setStatus("Posicione o cursor no texto de Connected Speech antes de inserir ‿.");
      return;
    }

    const editor = editorRefs.current.find((candidate) =>
      candidate?.contains(savedRange.commonAncestorContainer)
    );
    if (!editor) {
      setStatus("Clique primeiro no texto editável de Connected Speech.");
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
    setStatus("Símbolo de linking ‿ inserido.");
  }

  function reset() {
    blocks.forEach((block, index) => {
      const editor = editorRefs.current[index];
      if (editor) editor.textContent = block.original;
    });
    selectionRef.current = null;
    setRevision((value) => value + 1);
    setStatus("Edições restauradas a partir do inglês original.");
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
        if (!ok) throw new Error("Clipboard indisponível");
      }
      setStatus(rich ? "Conteúdo copiado (com formatação quando suportada)." : "Texto puro copiado.");
    } catch {
      setStatus("Não foi possível copiar. Verifique as permissões da área de transferência.");
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
          <button className="studio-button" onClick={() => void copy(false)}>Copiar texto puro</button>
          <button className="studio-button primary" onClick={() => void copy(true)}>Copiar formatado</button>
          <button className="studio-button" onClick={() => popup.print()}>Imprimir</button>
          <button className="studio-button" onClick={() => { popup.close(); onClose(); }}>Fechar</button>
        </div>
      </header>
      <div className="studio-toolbar">
        <label className="studio-size">Original (px)
          <input type="number" min="14" max="72" step="2" value={originalSize} onChange={(event) => setOriginalSize(Math.max(14, Math.min(72, Number(event.target.value) || 14)))} />
        </label>
        <label className="studio-size">Connected speech (px)
          <input type="number" min="14" max="72" step="2" value={connectedSize} onChange={(event) => setConnectedSize(Math.max(14, Math.min(72, Number(event.target.value) || 14)))} />
        </label>
        <span className="studio-divider" />
        <button className="studio-button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} title="Negrito"><b>B</b></button>
        <button className="studio-button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")} title="Sublinhar"><u>U</u></button>
        <button className="studio-button" onMouseDown={(event) => event.preventDefault()} onClick={insertLinkingSymbol} title="Inserir símbolo de linking (‿) na posição do cursor" aria-label="Inserir símbolo de linking">‿ Linking</button>
        <label className="studio-color" title="Cor do texto selecionado">Texto
          <input type="color" defaultValue="#2563eb" onChange={(event) => format("foreColor", event.target.value)} />
        </label>
        <label className="studio-color" title="Realce do texto selecionado">Marca-texto
          <input type="color" defaultValue="#fde68a" onChange={(event) => format("hiliteColor", event.target.value)} />
        </label>
        <span className="studio-divider" />
        <button className="studio-button" onClick={reset}>Restaurar edição</button>
      </div>
      <p className="studio-help">Posicione o cursor entre palavras e clique em ‿ Linking para inserir a ligação. Selecione um trecho para aplicar cor, marca-texto, negrito ou sublinhado. Os dois tamanhos de fonte são independentes. O texto original nunca é alterado.</p>
      <p className="studio-status" role="status">{status}</p>
      {blocks.map((block, index) => (
        <section className="studio-pair" key={`${revision}-${index}`}>
          <div className="studio-card">
            <h2>Original EN-US · {index + 1}</h2>
            {block.portuguese && <p className="studio-pt">{block.portuguese}</p>}
            <div className="studio-original" style={{ fontSize: originalSize }}>{block.original}</div>
          </div>
          <div className="studio-card">
            <h2>Connected Speech · Editável</h2>
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
              aria-label={`Editar connected speech do trecho ${index + 1}`}
            >{block.original}</div>
          </div>
        </section>
      ))}
    </main>,
    popup.document.body
  );
}

export function ConnectedSpeechButton({ title, blocks, label = "Connected Speech", compact = false }: ConnectedSpeechButtonProps) {
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
    return () => {
      popup.removeEventListener("beforeunload", handleClose);
      if (!popup.closed) popup.close();
    };
  }, [popup]);

  if (!desktop || blocks.length === 0) return null;

  function openStudio() {
    if (popup && !popup.closed) { popup.focus(); return; }
    const newWindow = window.open("", "_blank");
    if (!newWindow) { setError("O navegador bloqueou a nova aba. Permita pop-ups para este site."); return; }
    newWindow.document.title = `Connected Speech Studio — ${title}`;
    const style = newWindow.document.createElement("style");
    style.textContent = POPUP_STYLES;
    newWindow.document.head.appendChild(style);
    newWindow.focus();
    setError("");
    setPopup(newWindow);
  }

  return <>
    <button type="button" className="secondary-button" onClick={openStudio}
      title="Abrir Connected Speech Studio em nova aba" aria-label={`Connected Speech: ${title}`}
      style={compact ? { width: "2.5rem", minWidth: "2.5rem", height: "2.5rem", minHeight: "2.5rem", padding: 0, borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center" } : undefined}>
      <span aria-hidden="true">🎧</span>{!compact && <> {label} ↗</>}
    </button>
    {error && <span role="alert" style={{ color: "#b91c1c", fontSize: "0.8rem" }}>{error}</span>}
    {popup && !popup.closed && <StudioWindow popup={popup} title={title} blocks={blocks} onClose={() => setPopup(null)} />}
  </>;
}

import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import type { SpeakingGameSettings } from "../types/speakingGameTypes";

interface Props {
  settings: SpeakingGameSettings;
  onSettingsChange: (settings: SpeakingGameSettings) => void;
  onPrevious: () => void;
  onNext: () => void;
}

type OptionKey = "includeAdjective" | "includeNoun" | "includeRandomChunk";

export function SpeakingGameVocabularyStep({ settings, onSettingsChange, onPrevious, onNext }: Props) {
  const { t } = useTranslation();
  const options: Array<{ key: OptionKey; label: string }> = [
    { key: "includeAdjective", label: t("common.adjective") },
    { key: "includeNoun", label: t("common.noun") },
    { key: "includeRandomChunk", label: t("speaking.randomChunkIntention") }
  ];

  return <section style={styles.card} aria-labelledby="speaking-vocabulary-title">
    <header style={styles.header}>
      <span style={styles.step}>{t("speaking.step2Of3")}</span>
      <h1 id="speaking-vocabulary-title" style={styles.title}>{t("speaking.extraVocabulary")}</h1>
      <p style={styles.subtitle}>{t("speaking.chooseExtraVocabulary")}</p>
    </header>
    <div style={styles.options}>
      {options.map(({ key, label }) => {
        const checked = settings[key];
        return <label key={key} style={styles.option}>
          <span style={styles.optionLabel}>{label}</span>
          <span style={styles.choice}>
            <span>{t(checked ? "speaking.yes" : "speaking.no")}</span>
            <input
              type="checkbox"
              role="switch"
              checked={checked}
              onChange={event => onSettingsChange({ ...settings, [key]: event.target.checked })}
              aria-label={label}
              style={styles.switchInput}
            />
            <span aria-hidden="true" style={{ ...styles.track, ...(checked ? styles.trackChecked : {}) }}>
              <span style={{ ...styles.thumb, ...(checked ? styles.thumbChecked : {}) }} />
            </span>
          </span>
        </label>;
      })}
    </div>
    <footer style={styles.footer}>
      <button type="button" onClick={onPrevious} style={styles.secondaryButton}>{"← "}{t("common.previous")}</button>
      <button type="button" onClick={onNext} style={styles.primaryButton}>{t("speaking.next")}{" →"}</button>
    </footer>
  </section>;
}

const styles: Record<string, CSSProperties> = {
  card: { width: "min(100%, 34rem)", margin: "0 auto", boxSizing: "border-box", padding: "clamp(1rem, 4vw, 1.75rem)", border: "1px solid var(--border-strong)", borderRadius: 18, background: "var(--surface)", boxShadow: "0 8px 28px rgba(15,23,42,.08)" },
  header: { textAlign: "center", marginBottom: "1.6rem" },
  step: { display: "inline-block", fontSize: ".8rem", fontWeight: 700, color: "var(--muted)", marginBottom: ".5rem" },
  title: { fontSize: "1.55rem", margin: "0 0 .6rem" },
  subtitle: { color: "var(--muted)", margin: 0 },
  options: { display: "grid", gap: ".85rem" },
  option: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", border: "1px solid var(--border-strong)", borderRadius: 14, padding: "1rem", cursor: "pointer" },
  optionLabel: { fontSize: "1.05rem", fontWeight: 700 },
  choice: { display: "inline-flex", alignItems: "center", gap: ".7rem", fontSize: "1rem", fontWeight: 700, position: "relative" },
  switchInput: { position: "absolute", right: 0, width: 64, height: 36, opacity: 0, margin: 0, cursor: "pointer", zIndex: 1 },
  track: { width: 64, height: 36, borderRadius: 30, background: "var(--muted)", display: "inline-flex", alignItems: "center", padding: 4, boxSizing: "border-box", transition: "background .15s" },
  trackChecked: { background: "var(--accent, #2678c8)" },
  thumb: { display: "block", width: 28, height: 28, borderRadius: "50%", background: "#fff", transition: "transform .15s", boxShadow: "0 1px 4px #0004" },
  thumbChecked: { transform: "translateX(28px)" },
  footer: { display: "flex", justifyContent: "space-between", gap: 12, marginTop: "1.7rem" },
  primaryButton: { padding: ".8rem 1.2rem", borderRadius: 12, background: "var(--accent, #2678c8)", color: "#fff", border: 0, fontWeight: 700, cursor: "pointer" },
  secondaryButton: { padding: ".8rem 1.2rem", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "inherit", fontWeight: 700, cursor: "pointer" }
};

import { StudyCollapseToggle } from "./StudyCollapseToggle";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { STUDY_CHANGED, STUDY_KEY } from "./studyStorage";

const REFERENCE_BYTES = 5 * 1024 * 1024;
const HASHMAP_DATA_PREFIX = "mental-hashmap-data-";
type Snapshot = { sessions: number; studyRecords: number; studyBytes: number; hashmapRecords: number; hashmapBytes: number; allRecords: number; totalBytes: number };

function measureStorage(): Snapshot {
  let sessions = 0, studyRecords = 0, studyBytes = 0, hashmapRecords = 0, hashmapBytes = 0, allRecords = 0, totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null) continue;
    const value = localStorage.getItem(key) ?? "";
    // Matches the Console estimate; not the browser's actual quota accounting.
    const bytes = (key.length + value.length) * 2;
    allRecords++;
    totalBytes += bytes;
    if (key.startsWith(STUDY_KEY)) {
      studyRecords++;
      studyBytes += bytes;
      if (key.startsWith(STUDY_KEY + "session:")) sessions++;
    } else if (key.startsWith(HASHMAP_DATA_PREFIX)) {
      hashmapRecords++;
      hashmapBytes += bytes;
    }
  }
  return { sessions, studyRecords, studyBytes, hashmapRecords, hashmapBytes, allRecords, totalBytes };
}

export function StudyStorageOverview() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = () => {
    try { setSnapshot(measureStorage()); setFailed(false); }
    catch { setFailed(true); setSnapshot(null); }
  };
  useEffect(() => {
    refresh();
    window.addEventListener(STUDY_CHANGED, refresh);
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STUDY_CHANGED, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const format = (value: number) => value.toLocaleString(i18n.language);
  const size = (bytes: number) => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString(i18n.language, { maximumFractionDigits: 2 })} MiB`
    : `${(bytes / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 2 })} KB`;
  const share = (bytes: number) => snapshot && snapshot.totalBytes > 0 ? bytes / snapshot.totalBytes * 100 : 0;
  const percentage = (value: number) => `${value.toLocaleString(i18n.language, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
  const studyShare = snapshot ? share(snapshot.studyBytes) : 0;
  const hashmapShare = snapshot ? share(snapshot.hashmapBytes) : 0;
  const referencePercent = snapshot ? snapshot.totalBytes / REFERENCE_BYTES * 100 : 0;
  return <section className="study-panel bej-storage-overview" aria-label={t("studyStorage.title")}>
    <StudyCollapseToggle expanded={open} onToggle={() => setOpen(v => !v)} title={t("studyStorage.title")} />
    {open && <>
    <div className="bej-storage-heading"><button type="button" className="secondary-button" onClick={refresh}>{t("studyStorage.refresh")}</button></div>
    {failed ? <p role="alert">{t("studyStorage.unavailable")}</p> : snapshot && <>
      <div className="bej-storage-metrics">
        <div><span>{t("studyStorage.sessions")}</span><strong>{format(snapshot.sessions)}</strong></div>
        <div><span>{t("studyStorage.studyRecords")}</span><strong>{format(snapshot.studyRecords)}</strong></div>
        <div><span>{t("studyStorage.studySize")}</span><strong>{size(snapshot.studyBytes)}</strong></div>
        <div><span>{t("studyStorage.hashmapSize")}</span><strong>{size(snapshot.hashmapBytes)}</strong></div>
        <div><span>{t("studyStorage.otherSize")}</span><strong>{size(Math.max(0, snapshot.totalBytes - snapshot.studyBytes - snapshot.hashmapBytes))}</strong></div>
        <div><span>{t("studyStorage.totalRecords")}</span><strong>{format(snapshot.allRecords)}</strong></div>
        <div><span>{t("studyStorage.totalSize")}</span><strong>{size(snapshot.totalBytes)}</strong></div>
        <div><span>{t("studyStorage.studyShare")}</span><strong>{percentage(studyShare)}</strong></div>
        <div><span>{t("studyStorage.hashmapShare")}</span><strong>{percentage(hashmapShare)}</strong></div>
        <div><span>{t("studyStorage.referencePercent")}</span><strong>{percentage(referencePercent)}</strong></div>
      </div>
      <div className="bej-storage-distribution" role="img" aria-label={`${t("studyStorage.studyShare")}: ${percentage(studyShare)}; ${t("studyStorage.hashmapShare")}: ${percentage(hashmapShare)}`}>
        <span className="bej-storage-distribution-study" style={{ width: `${studyShare}%` }} />
        <span className="bej-storage-distribution-hashmap" style={{ width: `${hashmapShare}%` }} />
      </div>
      <p className="study-note">{t("studyStorage.distributionNote")}</p>
      <div className="bej-storage-reference">
        <div className="bej-storage-reference-label"><strong>{t("studyStorage.referencePercent")}</strong><strong>{percentage(referencePercent)}</strong></div>
        <div className="bej-storage-reference-bar" role="img" aria-label={`${t("studyStorage.referencePercent")}: ${percentage(referencePercent)}`}>
          <span style={{ width: `${Math.min(100, referencePercent)}%` }} />
        </div>
        <p className="study-note">{t("studyStorage.referenceNote")}</p>
      </div>
      <p className="study-note">{t("studyStorage.disclaimer")}</p>
    </>}
    </>}
  </section>;
}

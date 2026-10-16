import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import { CEFR_LEVELS, type ChunkLevel } from "../utils/chunkEligibility";

interface Props {
  value: ChunkLevel;
  onChange: (level: ChunkLevel) => void;
}

export function ChunkLevelSelect({ value, onChange }: Props) {
  const { t } = useTranslation();
  return <label className="chunk-level-select">{t("flashcards.cefrLevel")}
    <select value={value} onChange={event => onChange(event.target.value as ChunkLevel)}>
      <option value="all">{t("common.allLevels")}</option>
      {CEFR_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
    </select>
  </label>;
}

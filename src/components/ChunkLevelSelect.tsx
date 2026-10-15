import { CEFR_LEVELS, type ChunkLevel } from "../utils/chunkEligibility";

interface Props {
  value: ChunkLevel;
  onChange: (level: ChunkLevel) => void;
}

export function ChunkLevelSelect({ value, onChange }: Props) {
  return <label className="chunk-level-select">Nível CEFR
    <select value={value} onChange={event => onChange(event.target.value as ChunkLevel)}>
      <option value="all">Todos os níveis</option>
      {CEFR_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
    </select>
  </label>;
}

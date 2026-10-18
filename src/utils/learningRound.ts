export interface LearningRound {
  version: 1;
  round: number;
  completedRounds: number;
  presentedItemIds: string[];
  updatedAt: string;
}
export const roundKey = (language: string, module: string) => `bej-learning-round-v1:${language}:${module}`;
export function readRound(key: string): LearningRound {
  const raw = localStorage.getItem(key);
  if (raw) {
    const value = JSON.parse(raw) as LearningRound;
    if (value.version !== 1 || !Number.isInteger(value.round) || value.round < 1 ||
      value.completedRounds !== value.round - 1 || !Array.isArray(value.presentedItemIds) ||
      !value.presentedItemIds.every(id => typeof id === "string")) throw Error("Invalid learning round");
    return value;
  }
  return { version: 1, round: 1, completedRounds: 0, presentedItemIds: [], updatedAt: new Date().toISOString() };
}
// Callers hold the existing module study control for selection AND presentation.
// A filtered pool never discards progress in the full eligible catalog.
export function reconcileRound(key: string, eligible: string[]): LearningRound {
  const state = readRound(key), ids = new Set(eligible);
  state.presentedItemIds = [...new Set(state.presentedItemIds)].filter(id => ids.has(id));
  return state;
}
export function saveRound(key: string, state: LearningRound) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(state));
  window.dispatchEvent(new Event("bej-learning-round-changed"));
  return state;
}
export function finishRound(key: string, eligible: string[], fullCatalog = eligible) {
  const state = reconcileRound(key, fullCatalog);
  if (eligible.length && eligible.every(id => state.presentedItemIds.includes(id))) {
    state.round++; state.completedRounds++; state.presentedItemIds = [];
  }
  return saveRound(key, state);
}
export function presentItem(key: string, eligible: string[], id: string) {
  const state = reconcileRound(key, eligible);
  if (eligible.includes(id) && !state.presentedItemIds.includes(id)) state.presentedItemIds.push(id);
  return saveRound(key, state);
}

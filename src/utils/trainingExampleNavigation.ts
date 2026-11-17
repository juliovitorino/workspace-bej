/** Keep example browsing independent from the exercise round and answer state. */
export function trainingExampleIndex(index: number, total: number): number {
  return total > 0 ? ((index % total) + total) % total : 0;
}

export function nextTrainingExampleIndex(index: number, total: number): number {
  return total > 0 ? (trainingExampleIndex(index, total) + 1) % total : 0;
}

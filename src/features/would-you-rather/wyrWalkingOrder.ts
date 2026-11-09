/** Builds the question order once when a WRG walking session starts. */
export function orderWalkingItems<T>(items: readonly T[], randomOrder: boolean, random: () => number = Math.random): T[] {
  const ordered = [...items];
  if (!randomOrder) return ordered;
  // Fisher–Yates: every selected question is visited exactly once per session.
  for (let index = ordered.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  }
  return ordered;
}

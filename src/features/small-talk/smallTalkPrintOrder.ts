import type { SmallTalkItem } from '../../types/smallTalk';

/** The same ordering and eligibility rules are used for A4 printing and walking labels. */
export function printableSmallTalkItems(
  ordered: SmallTalkItem[], questionFor: (item: SmallTalkItem) => string
): SmallTalkItem[] {
  return ordered.filter(item => item.enabled && !!questionFor(item).trim());
}

/** One-based position in the complete printed topic, not the filtered or shuffled session. */
export function smallTalkPrintNumbers(items: SmallTalkItem[]): Record<string, number> {
  return Object.fromEntries(items.map((item, index) => [item.id, index + 1]));
}

/** Fractional catalog order preserves adjacency after custom-item sync when no manual order overrides it. */
export function duplicateCardOrder(items: SmallTalkItem[], source: SmallTalkItem): number {
  const next = items.map(item => item.order).filter(order => order > source.order).sort((a, b) => a - b)[0];
  const candidate = next === undefined ? source.order + 0.5 : source.order + (next - source.order) / 2;
  if (Number.isFinite(candidate) && candidate > source.order && (next === undefined || candidate < next)) return candidate;
  return Math.max(0, ...items.map(item => item.order)) + 1;
}

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

/** New copies always go to the end of the topic, preserving existing print numbers. */
export function nextSmallTalkCardOrder(items: SmallTalkItem[]): number {
  return Math.max(0, ...items.map(item => item.order)) + 1;
}

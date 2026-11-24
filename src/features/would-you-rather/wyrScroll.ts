/** The card to focus after a user explicitly navigates or reveals a response. */
export type WyrScrollTarget = "question" | "answerA" | "answerB";

/** Use native scrolling so the nearest scroll container works on desktop and mobile. */
export function scrollToWyrCard(element: Pick<HTMLElement, "scrollIntoView"> | null, reducedMotion: boolean): void {
  element?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

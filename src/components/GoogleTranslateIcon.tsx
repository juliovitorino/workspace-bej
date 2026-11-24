/** Shared Google Translate action icon, based on the original WRG SVG. */
export function GoogleTranslateIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 5h12M10 3v2m4 0c-.5 6-3 10-8 13M6 9c1 3 4 6 8 8M13 21l5-11 5 11m-8-4h6" />
    </svg>
  );
}

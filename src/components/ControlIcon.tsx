export function ControlIcon({ name, lucide = false }: { lucide?: boolean; name: "previous" | "next" | "pause" | "play" | "stop" | "settings" | "repeat" | "paragraph" }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {lucide && <>
      {name === "previous" && <><path d="m19 20-9-8 9-8z" /><path d="M5 19V5" /></>}
      {name === "next" && <><path d="m5 4 9 8-9 8z" /><path d="M19 5v14" /></>}
      {name === "pause" && <><rect x="14" y="3" width="5" height="18" rx="1" /><rect x="5" y="3" width="5" height="18" rx="1" /></>}
      {name === "play" && <polygon points="6 3 20 12 6 21 6 3" />}
      {name === "stop" && <rect x="3" y="3" width="18" height="18" rx="2" />}
      {name === "settings" && <><path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.12.91a2 2 0 0 1-1.18 1.52l-.2.09a2 2 0 0 1-1.9-.18l-.74-.55a2 2 0 0 0-2.54.43l-.22.38a2 2 0 0 0 .54 2.53l.74.56a2 2 0 0 1 .8 1.74v.22a2 2 0 0 1-.8 1.74l-.74.56a2 2 0 0 0-.54 2.53l.22.38a2 2 0 0 0 2.54.43l.74-.55a2 2 0 0 1 1.9-.18l.2.09a2 2 0 0 1 1.18 1.52l.12.91a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.12-.91a2 2 0 0 1 1.18-1.52l.2-.09a2 2 0 0 1 1.9.18l.74.55a2 2 0 0 0 2.54-.43l.22-.39a2 2 0 0 0-.54-2.52l-.74-.56a2 2 0 0 1-.8-1.74v-.22a2 2 0 0 1 .8-1.74l.74-.56a2 2 0 0 0 .54-2.53l-.22-.38a2 2 0 0 0-2.54-.43l-.74.55a2 2 0 0 1-1.9.18l-.2-.09a2 2 0 0 1-1.18-1.52l-.12-.91A2 2 0 0 0 12.22 2Z" /><circle cx="12" cy="11.36" r="3" /></>}
    </>}
    {!lucide && <>
    {name === "previous" && <><path d="M5 4v16" /><path d="m19 4-12 8 12 8Z" /></>}
    {name === "next" && <><path d="M19 4v16" /><path d="m5 4 12 8-12 8Z" /></>}
    {name === "pause" && <><path d="M8 5v14M16 5v14" /></>}
    {name === "play" && <path d="m7 4 13 8-13 8Z" />}
    {name === "stop" && <rect x="5" y="5" width="14" height="14" rx="1" />}
    </>}
    {name === "repeat" && <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></>}
    {name === "paragraph" && <><path d="M4 4h16M4 8h16M4 12h6M4 16h6M4 20h6" /><path d="m15 12 7 4-7 4Z" /></>}
    {name === "settings" && <><path d="m10 3-.5 2-2 1-2-.5-2 3L5 10v4l-1.5 1.5 2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3L19 14v-4l1.5-1.5-2-3-2 .5-2-1-.5-2Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>;
}


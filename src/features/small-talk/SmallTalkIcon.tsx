/** Consistent 24px stroke icons for Small Talk actions. Button labels remain on the buttons. */
export type SmallTalkIconName =
  | 'duplicate' | 'star' | 'eye' | 'eye-off' | 'edit' | 'trash' | 'printer'
  | 'clipboard' | 'globe' | 'settings' | 'arrow-up' | 'arrow-down'
  | 'plus' | 'minus' | 'play' | 'pause' | 'skip' | 'restart'
  | 'sort' | 'copy' | 'check' | 'close';

export function SmallTalkIcon({ name, filled = false }: { name: SmallTalkIconName; filled?: boolean }) {
  return <svg aria-hidden="true" focusable="false" width="21" height="21" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {name === 'duplicate' && <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/><path d="M14 11v6m-3-3h6"/></>}
    {name === 'star' && <path fill={filled ? 'currentColor' : 'none'} d="m12 2 3.1 6.4 7.1 1-5.1 5 .9 7.1L12 18.2l-6 3.3.9-7.1-5.1-5 7.1-1L12 2Z"/>}
    {name === 'eye' && <><path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>}
    {name === 'eye-off' && <><path d="M10.6 5.1A11.6 11.6 0 0 1 12 5c6.3 0 10 7 10 7a14 14 0 0 1-3.1 3.7M6.5 6.5C3.7 8.4 2 12 2 12s3.7 7 10 7c1.5 0 2.9-.4 4.1-1"/><path d="m3 3 18 18"/></>}
    {name === 'edit' && <><path d="M12 20h9M4 20l4.5-1 11-11a2 2 0 0 0-3-3l-11 11L4 20Z"/><path d="m14.5 7.5 3 3"/></>}
    {name === 'trash' && <><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6"/><path d="M10 10v7m4-7v7"/></>}
    {name === 'printer' && <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 15h12v6H6zM18 12h.01"/></>}
    {name === 'clipboard' && <><rect x="5" y="5" width="14" height="17" rx="2"/><path d="M9 5V3h6v2M9 10h6m-6 4h6m-6 4h4"/></>}
    {name === 'globe' && <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c-5 5-5 15 0 20m0-20c5 5 5 15 0 20"/></>}
    {name === 'settings' && <><path d="M10 2h4l.7 2.3 2 1.2 2.4-.5 2 3.5-1.8 1.7v2.4l1.8 1.7-2 3.5-2.4-.5-2 1.2L14 21h-4l-.7-2.3-2-1.2-2.4.5-2-3.5 1.8-1.7v-2.4L2.9 8.7l2-3.5 2.4.5 2-1.2L10 2Z"/><circle cx="12" cy="11.5" r="3"/></>}
    {name === 'arrow-up' && <><path d="m12 19 0-14m-6 6 6-6 6 6"/></>}
    {name === 'arrow-down' && <><path d="M12 5v14m-6-6 6 6 6-6"/></>}
    {name === 'plus' && <path d="M12 5v14M5 12h14"/>}
    {name === 'minus' && <path d="M5 12h14"/>}
    {name === 'play' && <path fill="currentColor" stroke="none" d="m7 4 13 8-13 8V4Z"/>}
    {name === 'pause' && <><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></>}
    {name === 'skip' && <><path d="m4 5 8 7-8 7V5Zm9 0 8 7-8 7V5Z"/><path d="M22 5v14"/></>}
    {name === 'restart' && <><path d="M3 11a9 9 0 1 1 3 7M3 4v7h7"/></>}
    {name === 'sort' && <><path d="M7 19V5m-4 4 4-4 4 4m6-4v14m-4-4 4 4 4-4"/></>}
    {name === 'copy' && <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>}
    {name === 'check' && <path d="m4 12 5 5L20 6"/>}
    {name === 'close' && <path d="M5 5 19 19M19 5 5 19"/>}
  </svg>;
}

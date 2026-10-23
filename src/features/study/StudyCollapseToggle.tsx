import type { ReactNode } from "react";

/** Accessible chevron: down when collapsed, up when expanded. */
export function StudyCollapseToggle({ expanded, onToggle, title, children }: {
  expanded: boolean; onToggle: () => void; title: string; children?: ReactNode;
}) {
  return <div className="bej-collapse-heading">
    {children ?? <h3>{title}</h3>}
    <button type="button" className="bej-collapse-toggle" onClick={onToggle}
      aria-label={`${expanded ? "Recolher" : "Expandir"}: ${title}`} aria-expanded={expanded} title={`${expanded ? "Recolher" : "Expandir"}: ${title}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" fillRule="evenodd" d={expanded ? "m12 8-6 5.61L7.487 15 12 10.78 16.513 15 18 13.61 12 8Z" : "m12 16-6-5.61L7.487 9 12 13.22 16.513 9 18 10.39 12 16Z"} clipRule="evenodd" />
      </svg>
    </button>
  </div>;
}

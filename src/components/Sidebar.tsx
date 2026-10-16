import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import { useState } from "react";
export type AppView = "memory-flashcards" | "hashmap" | "exercises" | "speaking-game" | "chunk-flashcards" | "interpretation" | "shadowing";
interface SidebarProps {
  onOpenLanguages: () => void;
  onOpenAbout: () => void;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export function Sidebar({
  currentView,
  onViewChange,
  onOpenLanguages,
  onOpenAbout
}: SidebarProps) {
  const { t } = useTranslation();
const menuItems: Array<{
  id: AppView;
  label: string;
}> = [
    {
      id: "hashmap",
      label: "Hashmap"
    },
    { 
      id: "shadowing", 
      label: t("common.shadowing") 
    },
    {
      id: "exercises",
      label: t("common.exercises")
    },
    {
      id: "chunk-flashcards",
      label: t("common.chunkFlashcards")
    },
    {
      id: "memory-flashcards",
      label: t("memory.title")
    },
    {
      id: "speaking-game",
      label: t("common.speakingGame")
    },
    {
      id: "interpretation",
      label: t("common.interpretation")
    }
  ];

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-short">BEJ</span>
        <span className="sidebar-brand-name">
          Brazilian English Journey
        </span>
      </div>

      <button type="button" className="sidebar-mobile-toggle" aria-expanded={menuOpen}
        aria-label={t("navigation.openMenu")} title={t("navigation.openMenu")}
        aria-controls="sidebar-navigation" onClick={() => setMenuOpen(open => !open)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <nav id="sidebar-navigation" className={`sidebar-menu${menuOpen ? " mobile-open" : ""}`} aria-label={t("navigation.mainMenu")}>
        {menuItems.map((item) => {
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={
                isActive
                  ? "sidebar-menu-item active"
                  : "sidebar-menu-item"
              }
              onClick={() => { setMenuOpen(false); onViewChange(item.id); }}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </button>
          );
        })}
        <button type="button" className="sidebar-menu-item" aria-haspopup="dialog" onClick={() => { setMenuOpen(false); onOpenLanguages(); }}>
          <span aria-hidden="true">🌐</span>  {t("navigation.languages")}
        </button>
        <button type="button" className="sidebar-menu-item" aria-haspopup="dialog" onClick={() => { setMenuOpen(false); onOpenAbout(); }}>
          <span aria-hidden="true">ⓘ</span>  {t("common.aboutTheApp")}
        </button>
      </nav>
    </aside>
  );
}

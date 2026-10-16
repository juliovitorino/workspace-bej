import { t } from "../i18n";
import { useTranslation } from "react-i18next";
import { useState } from "react";

const SIDEBAR_COLLAPSED_KEY = "bej-sidebar-collapsed";
import type { ThemePreference } from "../theme";
export type AppView = "personal-flashcards" | "memory-flashcards" | "hashmap" | "exercises" | "speaking-game" | "chunk-flashcards" | "interpretation" | "shadowing";
interface SidebarProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onOpenLanguages: () => void;
  onOpenAbout: () => void;
  currentView: AppView;
  personalCount: number;
  onViewChange: (view: AppView) => void;
}

export function Sidebar({
  theme,
  onThemeChange,
  currentView,
  personalCount,
  onViewChange,
  onOpenLanguages,
  onOpenAbout
}: SidebarProps) {
  const { t } = useTranslation();
const menuItems: Array<{
  id: AppView;
  label: string;
  icon: string;
}> = [
    {
      id: "hashmap",
      label: "Hashmap",
      icon: "🧠"
    },
    { 
      id: "shadowing", 
      label: t("common.shadowing"),
      icon: "🎧" 
    },
    {
      id: "exercises",
      label: t("common.exercises"),
      icon: "✏️"
    },
    {
      id: "chunk-flashcards",
      label: t("common.chunkFlashcards"),
      icon: "🗂️"
    },
    {
      id: "memory-flashcards",
      label: t("memory.title"),
      icon: "🃏"
    },
    ...(personalCount >= 1 ? [{ id: "personal-flashcards" as AppView, label: t("personal.title"), icon: "⭐" }] : []),
    {
      id: "speaking-game",
      label: t("common.speakingGame"),
      icon: "🎮"
    },
    {
      id: "interpretation",
      label: t("common.interpretation"),
      icon: "💬"
    }
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  function changeCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    } catch {
      // A preferência é opcional quando o armazenamento estiver indisponível.
    }
  }

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <div className="sidebar-brand">
        <span className="sidebar-brand-short">BEJ</span>
        <span className="sidebar-brand-name">
          Brazilian English Journey
        </span>
        <button
          type="button"
          className="sidebar-desktop-collapse-toggle"
          onClick={() => changeCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-expanded={!collapsed}
          aria-controls="sidebar-navigation"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            {collapsed ? <path d="m13 9 3 3-3 3" /> : <path d="m16 9-3 3 3 3" />}
          </svg>
        </button>
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
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-menu-icon" aria-hidden="true">{item.icon}</span>
              <span className="sidebar-menu-label">{item.label}</span>
            </button>
          );
        })}
        <button type="button" className="sidebar-menu-item" aria-haspopup="dialog"
          aria-label={t("navigation.languages")} title={collapsed ? t("navigation.languages") : undefined}
          onClick={() => { setMenuOpen(false); onOpenLanguages(); }}>
          <span className="sidebar-menu-icon" aria-hidden="true">🌐</span>
          <span className="sidebar-menu-label">{t("navigation.languages")}</span>
        </button>
        <button type="button" className="sidebar-theme-shortcut"
          aria-label={t("theme.label")} title={t("theme.label")}
          onClick={() => changeCollapsed(false)}>
          <span className="sidebar-menu-icon" aria-hidden="true">🎨</span>
          <span className="sidebar-menu-label">{t("theme.label")}</span>
        </button>
        <div className="sidebar-theme-control">
          <label htmlFor="bej-theme-select">{t("theme.label")}</label>
          <select id="bej-theme-select" value={theme} onChange={event => onThemeChange(event.target.value as ThemePreference)}>
            <option value="light">{t("theme.light")}</option>
            <option value="dark">{t("theme.dark")}</option>
            <option value="auto">{t("theme.auto")}</option>
          </select>
        </div>
        <button type="button" className="sidebar-menu-item" aria-haspopup="dialog"
          aria-label={t("common.aboutTheApp")} title={collapsed ? t("common.aboutTheApp") : undefined}
          onClick={() => { setMenuOpen(false); onOpenAbout(); }}>
          <span className="sidebar-menu-icon" aria-hidden="true">ⓘ</span>
          <span className="sidebar-menu-label">{t("common.aboutTheApp")}</span>
        </button>
      </nav>
    </aside>
  );
}

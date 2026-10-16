export type AppView = "memory-flashcards" | "hashmap" | "exercises" | "speaking-game" | "chunk-flashcards" | "interpretation" | "shadowing";
interface SidebarProps {
  onOpenLanguages: () => void;
  onOpenAbout: () => void;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

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
      label: "Shadowing" 
    },
    {
      id: "exercises",
      label: "Exercícios"
    },
    {
      id: "chunk-flashcards",
      label: "Chunk Flashcards"
    },
    {
      id: "memory-flashcards",
      label: "Memory Flashcards"
    },
    {
      id: "speaking-game",
      label: "Jogo da Fala"
    },
    {
      id: "interpretation",
      label: "Interpretação"
    }
  ];

export function Sidebar({
  currentView,
  onViewChange,
  onOpenLanguages,
  onOpenAbout
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-short">BEJ</span>
        <span className="sidebar-brand-name">
          Brazilian English Journey
        </span>
      </div>

      <nav className="sidebar-menu" aria-label="Menu principal">
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
              onClick={() => onViewChange(item.id)}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </button>
          );
        })}
        <button type="button" className="sidebar-menu-item" aria-haspopup="dialog" onClick={onOpenLanguages}>
          <span aria-hidden="true">🌐</span> Idiomas
        </button>
        <button type="button" className="sidebar-menu-item" aria-haspopup="dialog" onClick={onOpenAbout}>
          <span aria-hidden="true">ⓘ</span> Sobre o app
        </button>
      </nav>
    </aside>
  );
}

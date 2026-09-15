export type AppView = "hashmap" | "exercises" | "interpretation";

interface SidebarProps {
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
    id: "exercises",
    label: "Exercícios"
  },
  {
    id: "interpretation",
    label: "Interpretação"
  }
];

export function Sidebar({
  currentView,
  onViewChange
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
      </nav>
    </aside>
  );
}

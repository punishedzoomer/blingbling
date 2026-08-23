import { MessageSquare, Clock, BookOpen, Settings } from "lucide-react";
import { Surface } from "./types";

interface SidebarProps {
  surface: Surface;
  onChange: (surface: Surface) => void;
  collapsed: boolean;
}

const navItems: { id: Surface; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "history", label: "History", icon: Clock },
  { id: "notebook", label: "Notebooks", icon: BookOpen },
];

export function Sidebar({
  surface,
  onChange,
  collapsed,
}: SidebarProps) {
  const isSettingsActive = surface === "settings";

  return (
    <aside className={`windowed-sidebar ${collapsed ? "collapsed" : ""}`}>
      <nav className="windowed-nav" data-no-drag>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = surface === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`windowed-nav-btn ${isActive ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
              onClick={() => onChange(item.id)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Icon size={16} className="windowed-nav-icon" />
              {!collapsed && <span className="windowed-nav-label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Settings Button */}
      <div className="windowed-sidebar-footer" data-no-drag>
        <button
          type="button"
          className={`windowed-nav-btn ${isSettingsActive ? "active" : ""}`}
          title={collapsed ? "Settings" : undefined}
          onClick={() => onChange("settings")}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Settings size={16} className="windowed-nav-icon" />
          {!collapsed && <span className="windowed-nav-label">Settings</span>}
        </button>
      </div>
    </aside>
  );
}

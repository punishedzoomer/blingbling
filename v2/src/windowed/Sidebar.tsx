import { MessageSquare, Clock, BookOpen, Settings, Sparkles, Layout } from "lucide-react";
import { Surface } from "./types";

interface SidebarProps {
  surface: Surface;
  onChange: (surface: Surface) => void;
  collapsed: boolean;
  onStartDragging: (e: React.MouseEvent) => void;
  onSwitchToWidget: () => void;
}

const navItems: { id: Surface; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "history", label: "History", icon: Clock },
  { id: "notebook", label: "Notebooks", icon: BookOpen },
  { id: "tutorial", label: "Tutorial", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  surface,
  onChange,
  collapsed,
  onStartDragging,
  onSwitchToWidget,
}: SidebarProps) {
  return (
    <aside
      className={`windowed-sidebar ${collapsed ? "collapsed" : ""}`}
      onMouseDown={onStartDragging}
    >
      {/* Top macOS traffic light spacer and branding */}
      <div className="windowed-sidebar-top">
        {!collapsed ? (
          <div className="windowed-brand">
            <span className="windowed-brand-dot" />
            <span className="windowed-brand-name">Bling Bling</span>
          </div>
        ) : (
          <div className="windowed-brand-compact">
            <span className="windowed-brand-dot" />
          </div>
        )}
      </div>

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
            >
              <Icon size={16} className="windowed-nav-icon" />
              {!collapsed && <span className="windowed-nav-label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="windowed-sidebar-footer" data-no-drag>
        <button
          type="button"
          className="windowed-mode-btn"
          title="Switch to Floating Widget Mode"
          onClick={onSwitchToWidget}
        >
          <Layout size={15} />
          {!collapsed && <span>Widget Mode</span>}
        </button>
      </div>
    </aside>
  );
}

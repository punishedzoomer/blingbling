import { MessageSquare, Clock, BookOpen, Settings, Sparkles, Layout, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Surface } from "./types";

interface SidebarProps {
  surface: Surface;
  onChange: (surface: Surface) => void;
  collapsed: boolean;
  onToggleSidebar: () => void;
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
  onToggleSidebar,
  onStartDragging,
  onSwitchToWidget,
}: SidebarProps) {
  return (
    <aside
      className={`windowed-sidebar ${collapsed ? "collapsed" : ""}`}
      onMouseDown={onStartDragging}
    >
      {/* Top branding and collapse toggle */}
      <div className="windowed-sidebar-top">
        {!collapsed ? (
          <div className="windowed-brand">
            <span className="windowed-brand-dot" />
            <span className="windowed-brand-name">Bling Bling</span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="windowed-icon-btn"
              title="Collapse Sidebar"
              onClick={onToggleSidebar}
              onMouseDown={(e) => e.stopPropagation()}
              data-no-drag
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        ) : (
          <div className="windowed-brand-compact">
            <button
              type="button"
              className="windowed-icon-btn"
              title="Expand Sidebar"
              onClick={onToggleSidebar}
              onMouseDown={(e) => e.stopPropagation()}
              data-no-drag
            >
              <PanelLeftOpen size={16} />
            </button>
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
              onMouseDown={(e) => e.stopPropagation()}
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
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Layout size={15} />
          {!collapsed && <span>Widget Mode</span>}
        </button>
      </div>
    </aside>
  );
}

import { MessageSquare, Clock, BookOpen, Settings, Sparkles, Layout } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export type Surface = "chat" | "history" | "notebook" | "settings" | "tutorial";

interface SidebarProps {
  surface: Surface;
  onChange: (surface: Surface) => void;
}

const navItems: { id: Surface; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "history", label: "History", icon: Clock },
  { id: "notebook", label: "Notebooks", icon: BookOpen },
  { id: "tutorial", label: "Tutorial", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ surface, onChange }: SidebarProps) {
  return (
    <aside className="app-shell-sidebar">
      {/* Top native window drag handle area */}
      <div className="sidebar-drag-region" data-tauri-drag-region />

      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-dot" />
          <span className="brand-title">Bling Bling</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = surface === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => onChange(item.id)}
            >
              <Icon size={16} className="sidebar-nav-icon" />
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-mode-toggle"
          title="Switch to Floating Widget Mode"
          onClick={() => invoke("set_app_mode", { mode: "widget" })}
        >
          <Layout size={15} />
          <span>Widget Mode</span>
        </button>
      </div>
    </aside>
  );
}

import { PenSquare, Layout } from "lucide-react";
import { emit } from "@tauri-apps/api/event";
import { Surface } from "./types";

interface TitleBarProps {
  surface: Surface;
  setSurface: (surface: Surface) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onStartDragging: (e: React.MouseEvent) => void;
  onSwitchToWidget: () => void;
}

const titles: Record<Surface, string> = {
  chat: "Chat",
  history: "Conversation History",
  notebook: "Notebooks",
  settings: "Settings",
};

export function TitleBar({
  surface,
  setSurface,
  sidebarCollapsed,
  onToggleSidebar,
  onStartDragging,
  onSwitchToWidget,
}: TitleBarProps) {
  const handleNewChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSurface("chat");
    window.dispatchEvent(new CustomEvent("app-reset-session"));
    emit("reset-session").catch(() => {});
  };

  return (
    <header className="windowed-titlebar" onMouseDown={onStartDragging}>
      <div className="windowed-titlebar-left">
        <button
          type="button"
          className="windowed-icon-btn"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          onClick={onToggleSidebar}
          onMouseDown={(e) => e.stopPropagation()}
          data-no-drag
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path
              d="M9 3v18"
              style={{
                transform: sidebarCollapsed ? "translateX(-2.5px)" : "translateX(0)",
                opacity: sidebarCollapsed ? 0.6 : 1,
                transition: "transform 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease",
              }}
            />
          </svg>
        </button>

        <span className="windowed-title-text">{titles[surface]}</span>
      </div>

      <div className="windowed-titlebar-center" />

      <div className="windowed-titlebar-right" data-no-drag>
        <button
          type="button"
          className="windowed-action-btn"
          title="New Conversation (Cmd+N)"
          onClick={handleNewChat}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <PenSquare size={14} />
          <span>New Chat</span>
        </button>

        <button
          type="button"
          className="windowed-action-btn"
          title="Switch to Floating Widget Mode"
          onClick={(e) => {
            e.stopPropagation();
            onSwitchToWidget();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Layout size={14} />
          <span>Widget Mode</span>
        </button>
      </div>
    </header>
  );
}

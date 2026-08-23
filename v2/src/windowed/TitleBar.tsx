import { PanelLeftClose, PanelLeftOpen, PenSquare, Layout } from "lucide-react";
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
    await emit("reset-session");
  };

  return (
    <header className="windowed-titlebar" onMouseDown={onStartDragging}>
      <div
        className="windowed-titlebar-left"
        style={{ paddingLeft: sidebarCollapsed ? "24px" : "4px" }}
      >
        <button
          type="button"
          className="windowed-icon-btn"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          onClick={onToggleSidebar}
          onMouseDown={(e) => e.stopPropagation()}
          data-no-drag
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
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

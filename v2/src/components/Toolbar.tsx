import { Square, X, ChevronDown, AppWindow } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const LogoIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-megaphone-icon lucide-megaphone">
    <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
    <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/>
    <path d="M8 6v8"/>
  </svg>
);

export function Toolbar({ isCollapsed, setIsCollapsed }: { isCollapsed: boolean, setIsCollapsed: (v: boolean) => void }) {
  return (
    <div id="toolbar" className="drag-handle" onPointerDown={(e) => {
      if (e.buttons === 1 && !(e.target as HTMLElement).closest('button')) {
        e.preventDefault();
        getCurrentWindow().startDragging();
      }
    }}>
      <div className="drag-pill" title="Drag to move window">
        <span className="drag-dots" aria-hidden="true"></span>
        <span className="drag-label">Drag</span>
      </div>
      <button className="tb-logo" id="logo-btn" title="Tutorial" onClick={async () => {
        await invoke("show_panel", { label: "tutorial" }).catch(() => {
          alert("Could not open Tutorial window. Please restart the app for the multi-window update to take effect!");
        });
      }}>
        <LogoIcon size={16} />
      </button>
      <div className="tb-divider"></div>
      <button className="tb-mode" id="mode-btn" title="Switch to Full Windowed Mode" onClick={() => invoke("set_app_mode", { mode: "windowed" })}>
        <AppWindow size={14} />
      </button>
      <div className="tb-divider"></div>
      <button className={`tb-hide ${isCollapsed ? "collapsed" : ""}`} id="hide-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="chev"><ChevronDown size={14} /></span>
        <span>{isCollapsed ? "Show" : "Hide"}</span>
      </button>
      <div className="tb-divider"></div>
      <button className="tb-stop" id="stop-btn" title="Stop AI" onClick={async () => {
        await invoke("cancel_ai_response");
      }}>
        <Square size={14} />
      </button>
      <div className="tb-divider"></div>
      <button className="tb-quit" id="quit-btn" title="Quit" onClick={() => invoke("quit_app")}>
        <X size={14} />
      </button>
    </div>
  );
}

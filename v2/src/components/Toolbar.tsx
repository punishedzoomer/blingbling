import { Square, X, ChevronDown } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const LogoIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.8"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    <circle cx="12" cy="12" r="3" fill="var(--accent)" opacity="0.9" />
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

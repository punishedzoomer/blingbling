import { invoke } from "@tauri-apps/api/core";

export function LogoIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function Header() {
  return (
    <div className="header-drag-region" data-tauri-drag-region style={{ zIndex: 10 }}>
      <div className="tb" style={{ zIndex: 20 }}>
        <button className="tb-logo" id="logo-btn" title="Tutorial" onClick={async () => {
          await invoke("show_panel", { label: "tutorial" }).catch(() => {
            alert("Could not open Tutorial window. Please restart the app for the multi-window update to take effect!");
          });
        }}>
          <LogoIcon size={16} />
        </button>
      </div>
    </div>
  );
}

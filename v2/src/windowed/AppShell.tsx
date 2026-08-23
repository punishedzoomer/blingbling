import { useWindowedShell } from "./useWindowedShell";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { WindowedContainer } from "./WindowedContainer";
import "./windowed.css";

export function AppShell() {
  const {
    surface,
    setSurface,
    sidebarCollapsed,
    toggleSidebar,
    handleStartDragging,
    switchToWidgetMode,
  } = useWindowedShell();

  return (
    <div className="windowed-shell-root">
      <Sidebar
        surface={surface}
        onChange={setSurface}
        collapsed={sidebarCollapsed}
        onStartDragging={handleStartDragging}
      />

      <div className="windowed-shell-main">
        <TitleBar
          surface={surface}
          setSurface={setSurface}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          onStartDragging={handleStartDragging}
          onSwitchToWidget={switchToWidgetMode}
        />

        <WindowedContainer surface={surface} setSurface={setSurface} />
      </div>
    </div>
  );
}

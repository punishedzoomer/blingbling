import App from "../App";
import { HistoryApp } from "../HistoryApp";
import { NotebookApp } from "../NotebookApp";
import { SettingsApp } from "../SettingsApp";
import { TutorialApp } from "../TutorialApp";
import { Surface } from "./types";

interface WindowedContainerProps {
  surface: Surface;
  setSurface: (surface: Surface) => void;
}

export function WindowedContainer({ surface, setSurface }: WindowedContainerProps) {
  return (
    <main className="windowed-container">
      {/* Persistently mounted Chat surface */}
      <div
        className="windowed-surface-chat"
        style={{ display: surface === "chat" ? "flex" : "none" }}
      >
        <App isWindowed={true} />
      </div>

      {/* Auxiliary surfaces */}
      {surface === "history" && (
        <div className="windowed-surface-aux">
          <HistoryApp isWindowed={true} onOpenChat={() => setSurface("chat")} />
        </div>
      )}

      {surface === "notebook" && (
        <div className="windowed-surface-aux">
          <NotebookApp
            isWindowed={true}
            onOpenChat={() => setSurface("chat")}
            onOpenHistory={() => setSurface("history")}
          />
        </div>
      )}

      {surface === "settings" && (
        <div className="windowed-surface-aux">
          <SettingsApp isWindowed={true} onDone={() => setSurface("chat")} />
        </div>
      )}

      {surface === "tutorial" && (
        <div className="windowed-surface-aux">
          <TutorialApp isWindowed={true} onDone={() => setSurface("chat")} />
        </div>
      )}
    </main>
  );
}

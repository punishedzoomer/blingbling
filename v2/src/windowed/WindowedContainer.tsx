import { useState, useCallback } from "react";
import App from "../App";
import { HistoryApp } from "../HistoryApp";
import { NotebookApp } from "../NotebookApp";
import { NotebookList } from "../components/NotebookList";
import { SettingsApp } from "../SettingsApp";
import { TutorialApp } from "../TutorialApp";
import { Surface } from "./types";

interface WindowedContainerProps {
  surface: Surface;
  setSurface: (surface: Surface) => void;
}

export function WindowedContainer({ surface, setSurface }: WindowedContainerProps) {
  const [activeNotebookId, setActiveNotebookId] = useState<number | null>(() => {
    const saved = localStorage.getItem("activeNotebookId");
    return saved ? parseInt(saved, 10) : null;
  });

  const handleSelectNotebook = useCallback(
    (id: number) => {
      setActiveNotebookId(id);
      localStorage.setItem("activeNotebookId", String(id));
      setSurface("notebook");
    },
    [setSurface]
  );

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
          <HistoryApp
            isWindowed={true}
            onOpenChat={() => setSurface("chat")}
            onSelectNotebook={handleSelectNotebook}
          />
        </div>
      )}

      {surface === "notebook" && (
        <div className="windowed-surface-aux">
          {activeNotebookId ? (
            <NotebookApp
              isWindowed={true}
              notebookId={activeNotebookId}
              onBack={() => setActiveNotebookId(null)}
              onOpenChat={() => setSurface("chat")}
              onOpenHistory={() => setSurface("history")}
            />
          ) : (
            <div
              style={{
                padding: "16px 20px",
                height: "100%",
                maxWidth: "800px",
                margin: "0 auto",
                width: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <NotebookList onSelectNotebook={handleSelectNotebook} />
            </div>
          )}
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

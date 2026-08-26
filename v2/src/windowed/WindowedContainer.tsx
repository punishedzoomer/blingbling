import { useState, useCallback, useRef, useEffect } from "react";
import App from "../App";
import { HistoryApp } from "../HistoryApp";
import { NotebookApp } from "../NotebookApp";
import { NotebookList } from "../components/NotebookList";
import { SettingsApp } from "../SettingsApp";
import { Surface } from "./types";

interface WindowedContainerProps {
  surface: Surface;
  setSurface: (surface: Surface) => void;
}

export function WindowedContainer({ surface, setSurface }: WindowedContainerProps) {
  const [activeNotebookId, setActiveNotebookId] = useState<number | null>(null);

  const visitedSurfaces = useRef<Set<Surface>>(new Set(["chat"]));
  visitedSurfaces.current.add(surface);

  useEffect(() => {
    if (surface !== "notebook") {
      setActiveNotebookId(null);
    }
    if (surface === "chat") {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("focus-prompt-input"));
      }, 50);
    }
  }, [surface]);

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
      {/* 1. Persistently mounted Chat surface */}
      <div
        className="windowed-surface-chat"
        style={{ display: surface === "chat" ? "flex" : "none" }}
      >
        <App isWindowed={true} />
      </div>

      {/* 2. History surface (lazy-mounted on first visit, then cached) */}
      {visitedSurfaces.current.has("history") && (
        <div
          className="windowed-surface-aux"
          style={{ display: surface === "history" ? "flex" : "none" }}
        >
          <HistoryApp
            isWindowed={true}
            onOpenChat={() => setSurface("chat")}
          />
        </div>
      )}

      {/* 3. Notebooks surface (lazy-mounted on first visit, then cached) */}
      {visitedSurfaces.current.has("notebook") && (
        <div
          className="windowed-surface-aux"
          style={{ display: surface === "notebook" ? "flex" : "none" }}
        >
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

      {/* 4. Settings surface (lazy-mounted on first visit, then cached) */}
      {visitedSurfaces.current.has("settings") && (
        <div
          className="windowed-surface-aux"
          style={{ display: surface === "settings" ? "flex" : "none" }}
        >
          <SettingsApp isWindowed={true} onDone={() => setSurface("chat")} />
        </div>
      )}
    </main>
  );
}

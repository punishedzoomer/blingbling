import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import { HistoryApp } from "./HistoryApp";
import { NotebookApp } from "./NotebookApp";
import { SettingsApp } from "./SettingsApp";
import { TutorialApp } from "./TutorialApp";
import { Sidebar, Surface } from "./components/Sidebar";
import "./App.css";

export function AppShell() {
  const [surface, setSurface] = useState<Surface>("chat");

  useEffect(() => {
    document.body.setAttribute("data-mode", "windowed");
    return () => {
      document.body.removeAttribute("data-mode");
    };
  }, []);

  // Listen for navigation requests from Tauri backend or global shortcuts
  useEffect(() => {
    let unlistenActive: any;
    let unlistenRestore: any;
    let unlistenReset: any;

    listen<string>("set-active-surface", (e) => {
      if (!e.payload) return;
      const target = e.payload.toLowerCase();
      if (target === "main" || target === "chat") {
        setSurface("chat");
      } else if (target === "history") {
        setSurface("history");
      } else if (target === "notebook") {
        setSurface("notebook");
      } else if (target === "settings") {
        setSurface("settings");
      } else if (target === "tutorial") {
        setSurface("tutorial");
      }
    }).then((f) => (unlistenActive = f));

    listen("restore-session", () => {
      setSurface("chat");
    }).then((f) => (unlistenRestore = f));

    listen("reset-session", () => {
      setSurface("chat");
    }).then((f) => (unlistenReset = f));

    return () => {
      if (unlistenActive) unlistenActive();
      if (unlistenRestore) unlistenRestore();
      if (unlistenReset) unlistenReset();
    };
  }, []);

  return (
    <div className="app-shell-root">
      <Sidebar surface={surface} onChange={setSurface} />
      <div className="app-shell-content">
        <header className="app-shell-topbar" data-tauri-drag-region>
          <div className="app-shell-title-pill">
            {surface === "chat" && "Chat"}
            {surface === "history" && "Conversation History"}
            {surface === "notebook" && "Notebooks"}
            {surface === "settings" && "Settings"}
            {surface === "tutorial" && "Welcome & Tutorial"}
          </div>
        </header>
        <main className="app-shell-main-area">
          {surface === "chat" && <App isWindowed={true} />}
          {surface === "history" && (
            <HistoryApp isWindowed={true} onOpenChat={() => setSurface("chat")} />
          )}
          {surface === "notebook" && (
            <NotebookApp
              isWindowed={true}
              onOpenChat={() => setSurface("chat")}
              onOpenHistory={() => setSurface("history")}
            />
          )}
          {surface === "settings" && (
            <SettingsApp isWindowed={true} onDone={() => setSurface("chat")} />
          )}
          {surface === "tutorial" && (
            <TutorialApp isWindowed={true} onDone={() => setSurface("chat")} />
          )}
        </main>
      </div>
    </div>
  );
}

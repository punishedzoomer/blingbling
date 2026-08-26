import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { AppShell } from "./windowed/AppShell";
import { SettingsApp } from "./SettingsApp";
import { HistoryApp } from "./HistoryApp";
import { SnipApp } from "./SnipApp";
import { TutorialApp } from "./TutorialApp";
import { NotebookApp } from "./NotebookApp";

const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  originalLog(...args);
  invoke("console_log", { msg: args.join(" ") }).catch(() => {});
};
console.error = (...args) => {
  originalError(...args);
  invoke("console_log", { msg: "ERROR: " + args.join(" ") }).catch(() => {});
};

import { initTheme } from "./utils/theme";

// Initialize unified glassmorphism theme across all windows
initTheme();

function Router() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  if (!label) return null;

  if (label === "app-shell") {
    return <AppShell />;
  } else if (label === "settings") {
    return <SettingsApp />;
  } else if (label === "history") {
    return <HistoryApp />;
  } else if (label === "snip") {
    return <SnipApp />;
  } else if (label === "tutorial") {
    return <TutorialApp />;
  } else if (label === "notebook") {
    return <NotebookApp />;
  } else if (label === "chat-panel") {
    return <App windowLabel="chat-panel" />;
  }
  
  return <App windowLabel="main" />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <Router />
);

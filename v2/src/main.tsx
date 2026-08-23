import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import { AppShell } from "./windowed/AppShell";
import { SettingsApp } from "./SettingsApp";
import { HistoryApp } from "./HistoryApp";
import { SnipApp } from "./SnipApp";
import { TutorialApp } from "./TutorialApp";
import { NotebookApp } from "./NotebookApp";

function applyGlassOpacity(opacityPercent: number) {
  const alpha = Math.max(0.1, Math.min(1.0, opacityPercent / 100));
  const docStyle = document.documentElement.style;
  
  // Widget tokens
  docStyle.setProperty("--glass-bg", `rgba(20, 22, 28, ${alpha})`);
  
  // Windowed mode tokens
  docStyle.setProperty("--windowed-bg", `rgba(17, 18, 22, ${alpha})`);
  docStyle.setProperty("--windowed-titlebar-bg", `rgba(21, 23, 30, ${alpha})`);
  docStyle.setProperty("--windowed-sidebar-bg", `rgba(20, 22, 29, ${alpha})`);
  docStyle.setProperty("--windowed-card-bg", `rgba(25, 27, 35, ${alpha})`);
  docStyle.setProperty("--windowed-composer-bg", `rgba(22, 25, 33, ${Math.min(1, alpha + 0.02)})`);
}

// Initial opacity from localStorage
const savedOpacity = localStorage.getItem("glassOpacity");
if (savedOpacity) {
  const val = parseFloat(savedOpacity);
  if (!isNaN(val)) {
    applyGlassOpacity(val);
  }
}

// Listen for dynamic opacity changes across all windows
listen("glass-opacity-changed", (event: any) => {
  if (event.payload?.opacity !== undefined) {
    const val = parseFloat(event.payload.opacity);
    if (!isNaN(val)) {
      applyGlassOpacity(val);
    }
  }
});

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
  }
  
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <Router />
);

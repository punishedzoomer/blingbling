import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { SettingsApp } from "./SettingsApp";
import { HistoryApp } from "./HistoryApp";
import { SnipApp } from "./SnipApp";
import { TutorialApp } from "./TutorialApp";
import { NotebookApp } from "./NotebookApp";

function Router() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  if (!label) return null;

  if (label === "settings") {
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

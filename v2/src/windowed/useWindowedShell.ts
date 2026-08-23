import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Surface } from "./types";

export function useWindowedShell() {
  const [surface, setSurface] = useState<Surface>("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }, []);

  const handleStartDragging = useCallback((e: React.MouseEvent) => {
    if (e.buttons === 1) {
      const target = e.target as HTMLElement;
      if (!target.closest("button, input, select, textarea, a, [data-no-drag]")) {
        getCurrentWindow().startDragging();
      }
    }
  }, []);

  const switchToWidgetMode = useCallback(async () => {
    try {
      await invoke("set_app_mode", { mode: "widget" });
    } catch (err) {
      console.error("Failed to switch to widget mode:", err);
    }
  }, []);

  // Set data-mode attribute on body for scoped styles
  useEffect(() => {
    document.body.setAttribute("data-mode", "windowed");
    return () => {
      document.body.removeAttribute("data-mode");
    };
  }, []);

  // Cross-window and internal event listeners
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

  return {
    surface,
    setSurface,
    sidebarCollapsed,
    toggleSidebar,
    handleStartDragging,
    switchToWidgetMode,
  };
}

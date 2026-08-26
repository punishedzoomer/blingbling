import { emit, listen } from "@tauri-apps/api/event";

const OPACITY_STORAGE_KEY = "glassOpacity";
const DEFAULT_OPACITY = 85; // 85% provides beautiful translucency while maintaining readability

export function getStoredGlassOpacity(): number {
  try {
    const saved = localStorage.getItem(OPACITY_STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 100) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read glass opacity from localStorage:", e);
  }
  return DEFAULT_OPACITY;
}

export function applyThemeTokens(_opacityPercent?: number) {
  const docStyle = document.documentElement.style;

  // Unified Alpha Token (Solid)
  docStyle.setProperty("--glass-alpha", "1.0");

  // Widget Mode Solid Tokens
  docStyle.setProperty("--glass-bg", "#14161d");
  docStyle.setProperty("--glass-border", "rgba(255, 255, 255, 0.12)");
  docStyle.setProperty("--glass-blur", "none");
  docStyle.setProperty("--glass-shadow", "0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)");

  // Windowed Mode Solid Tokens
  docStyle.setProperty("--windowed-bg", "#111216");
  docStyle.setProperty("--windowed-titlebar-bg", "#15171e");
  docStyle.setProperty("--windowed-sidebar-bg", "#14161d");
  docStyle.setProperty("--windowed-card-bg", "#191b23");
  docStyle.setProperty("--windowed-composer-bg", "#161921");
}

export function setGlassOpacity(percent: number, broadcast: boolean = true) {
  const clamped = Math.max(20, Math.min(100, Math.round(percent)));
  try {
    localStorage.setItem(OPACITY_STORAGE_KEY, clamped.toString());
  } catch (e) {
    console.error("Failed to save glass opacity to localStorage:", e);
  }
  
  applyThemeTokens(clamped);

  if (broadcast) {
    emit("glass-opacity-changed", { opacity: clamped }).catch((err) => {
      console.error("Failed to broadcast glass-opacity-changed event:", err);
    });
  }
}

export function initTheme() {
  const initialOpacity = getStoredGlassOpacity();
  applyThemeTokens(initialOpacity);

  // Listen for opacity change events broadcasted across any webview window
  const unlistenPromise = listen<{ opacity: number }>("glass-opacity-changed", (event) => {
    if (event.payload && typeof event.payload.opacity === "number") {
      applyThemeTokens(event.payload.opacity);
    }
  });

  return () => {
    unlistenPromise.then((unlisten) => unlisten());
  };
}

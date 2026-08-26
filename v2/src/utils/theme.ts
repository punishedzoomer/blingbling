import { emit, listen } from "@tauri-apps/api/event";

const OPACITY_STORAGE_KEY = "glassOpacity";
const DEFAULT_OPACITY = 80; // 80% provides unified translucency across widget & windowed modes

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

export function applyThemeTokens(opacityPercent: number = DEFAULT_OPACITY) {
  const alpha = Math.max(0.2, Math.min(1.0, opacityPercent / 100));
  const docStyle = document.documentElement.style;

  // Unified Alpha Token (Exactly 0.80 for 80%)
  docStyle.setProperty("--glass-alpha", alpha.toFixed(3));

  // Surfaces (Translucent, zero-flicker, zero blur overhead)
  docStyle.setProperty("--glass-bg", `rgba(18, 20, 26, ${alpha.toFixed(3)})`);
  docStyle.setProperty("--modal-glass-bg", `rgba(18, 20, 26, ${alpha.toFixed(3)})`);
  docStyle.setProperty("--glass-border", `rgba(255, 255, 255, ${Math.min(0.25, 0.08 + (1 - alpha) * 0.1).toFixed(3)})`);
  docStyle.setProperty("--glass-shadow", `0 16px 40px rgba(0, 0, 0, ${(0.3 + alpha * 0.2).toFixed(2)}), inset 0 1px 0 rgba(255, 255, 255, 0.08)`);

  // Windowed Mode Tokens (100% unified with widget glass-bg)
  docStyle.setProperty("--windowed-bg", `rgba(18, 20, 26, ${alpha.toFixed(3)})`);
  docStyle.setProperty("--windowed-titlebar-bg", "rgba(255, 255, 255, 0.02)");
  docStyle.setProperty("--windowed-sidebar-bg", "rgba(0, 0, 0, 0.12)");
  docStyle.setProperty("--windowed-card-bg", "rgba(255, 255, 255, 0.03)");
  docStyle.setProperty("--windowed-composer-bg", "rgba(0, 0, 0, 0.15)");
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

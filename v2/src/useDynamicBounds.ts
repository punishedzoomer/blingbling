import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useDynamicBounds(label: string = "main") {
  useEffect(() => {
    const el = document.body;
    if (!el) return;

    // Use a small debounce/throttle mechanism to avoid spamming IPC calls
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (timeout) clearTimeout(timeout);
        
        // Wait just a tiny bit for React/DOM to finish layout recalculations
        timeout = setTimeout(async () => {
          const rect = entry.target.getBoundingClientRect();
          // We add 1 pixel to avoid fractional clipping issues
          const width = Math.ceil(rect.width) + 1;
          const height = Math.ceil(rect.height) + 1;
          
          try {
            await invoke("resize_panel", { label, width, height });
          } catch (e) {
            console.error("Failed to dynamically resize panel:", e);
          }
        }, 10);
      }
    });

    resizeObserver.observe(el);

    return () => {
      if (timeout) clearTimeout(timeout);
      resizeObserver.disconnect();
    };
  }, [label]);
}

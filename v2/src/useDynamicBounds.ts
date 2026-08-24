import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useDynamicBounds(label: string = "main", enabled: boolean = true) {
  const lastDimensions = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || label !== "main") return;

    const el = document.getElementById("app") || document.getElementById("toolbar") || document.body;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (rafId.current) cancelAnimationFrame(rafId.current);

        rafId.current = requestAnimationFrame(async () => {
          const rect = entry.target.getBoundingClientRect();
          const width = Math.round(rect.width);
          const height = Math.round(rect.height);

          if (
            Math.abs(lastDimensions.current.width - width) < 2 &&
            Math.abs(lastDimensions.current.height - height) < 2
          ) {
            return;
          }

          lastDimensions.current = { width, height };

          try {
            await invoke("resize_panel", { label, width, height });
          } catch (e) {
            console.error("Failed to dynamically resize panel:", e);
          }
        });
      }
    });

    resizeObserver.observe(el);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      resizeObserver.disconnect();
    };
  }, [label, enabled]);
}

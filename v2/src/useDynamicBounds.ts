import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useDynamicBounds(label: string = "main") {
  const lastDimensions = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const el = document.body;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (rafId.current) cancelAnimationFrame(rafId.current);

        rafId.current = requestAnimationFrame(async () => {
          const rect = entry.target.getBoundingClientRect();
          const width = Math.ceil(rect.width) + 1;
          const height = Math.ceil(rect.height) + 1;

          if (
            lastDimensions.current.width === width &&
            lastDimensions.current.height === height
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
  }, [label]);
}

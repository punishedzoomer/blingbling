import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

export function SnipApp() {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const unlisten = listen("setup_snip", async () => {
      try {
        const img = await invoke<string>("capture_screen");
        setBgImage(img);
        setStartPos({ x: 0, y: 0 });
        setCurrentPos({ x: 0, y: 0 });
        setIsDragging(false);
      } catch (e) {
        console.error("Failed to get snip image:", e);
      }
    });

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await invoke("hide_panel", { label: "snip" });
        await emit("snip_finished", "");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unlisten.then(f => f());
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!bgImage) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = async () => {
    if (!isDragging || !bgImage) return;
    setIsDragging(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width < 10 || height < 10) {
      // Too small, probably a mistake, cancel it
      await invoke("hide_panel", { label: "snip" });
      await emit("snip_finished", "");
      return;
    }

    try {
      // Hide the panel first
      await invoke("hide_panel", { label: "snip" });
      
      // Crop the image using Canvas
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        
        // Scale coordinates to actual image dimensions
        const scaleX = img.width / window.innerWidth;
        const scaleY = img.height / window.innerHeight;
        
        const cropX = Math.round(x * scaleX);
        const cropY = Math.round(y * scaleY);
        const cropW = Math.round(width * scaleX);
        const cropH = Math.round(height * scaleY);
        
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d")!;
        
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        
        const croppedBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
        await emit("snip_finished", croppedBase64);
      };
      img.src = bgImage;
      
    } catch (e) {
      console.error(e);
      await emit("snip_finished", "");
    }
  };

  const x = Math.min(startPos.x, currentPos.x);
  const y = Math.min(startPos.y, currentPos.y);
  const width = Math.abs(currentPos.x - startPos.x);
  const height = Math.abs(currentPos.y - startPos.y);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        width: "100vw",
        height: "100vh",
        cursor: "crosshair",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "transparent"
      }}
    >
      {bgImage && (
        <img 
          src={bgImage} 
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            zIndex: 0
          }} 
          alt="screen" 
        />
      )}
      
      {isDragging ? (
        <div
          style={{
            position: "absolute",
            left: x,
            top: y,
            width,
            height,
            border: "1px solid rgba(255, 255, 255, 0.8)",
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.4)",
            background: "transparent",
            pointerEvents: "none",
            zIndex: 10
          }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.4)", pointerEvents: "none", zIndex: 10 }} />
      )}
    </div>
  );
}

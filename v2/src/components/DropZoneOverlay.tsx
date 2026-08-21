import { Upload } from "lucide-react";

interface DropZoneOverlayProps {
  isDragging: boolean;
}

export function DropZoneOverlay({ isDragging }: DropZoneOverlayProps) {
  if (!isDragging) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: "rgba(20, 24, 34, 0.85)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderRadius: "var(--r-panel)",
        border: "2px dashed var(--accent)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        pointerEvents: "none",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(60, 131, 245, 0.15)",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "color-mix(in srgb, var(--accent) 18%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent)",
        }}
      >
        <Upload size={28} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#fff", fontSize: "14px", fontWeight: 600, letterSpacing: "0.01em" }}>
          Drop files or images to attach
        </div>
        <div style={{ color: "var(--tx-mut)", fontSize: "12px", marginTop: "4px" }}>
          Supports images, PDFs, code files, and markdown notes
        </div>
      </div>
    </div>
  );
}

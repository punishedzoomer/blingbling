import { useEffect } from "react";
import { X } from "lucide-react";

interface ImagePreviewModalProps {
  previewImage: string | null;
  onClose: () => void;
}

export function ImagePreviewModal({ previewImage, onClose }: ImagePreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (previewImage) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImage, onClose]);

  if (!previewImage) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(18, 18, 22, 0.65)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderRadius: "24px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "36px",
        cursor: "zoom-out",
        pointerEvents: "auto",
      }}
    >
      <button
        style={{
          position: "absolute",
          top: "18px",
          right: "18px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          cursor: "pointer",
          zIndex: 10000,
          pointerEvents: "auto",
          backdropFilter: "blur(12px)",
          transition: "all 0.15s ease",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Close Preview (Esc)"
      >
        <X size={18} />
      </button>
      <img
        src={previewImage}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: "12px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)",
          cursor: "default",
        }}
        alt="Enlarged attachment preview"
      />
    </div>
  );
}

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 12, 16, 0.65)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        pointerEvents: "auto",
        animation: "fadeIn 0.12s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(22, 24, 30, 0.96)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "14px",
          padding: "16px 18px",
          maxWidth: "310px",
          width: "100%",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {danger && (
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
                flexShrink: 0,
              }}
            >
              <AlertCircle size={15} />
            </div>
          )}
          <div style={{ color: "rgba(255,255,255,0.95)", fontSize: "14px", fontWeight: 600 }}>
            {title}
          </div>
        </div>

        {message && (
          <div style={{ color: "var(--tx-mut)", fontSize: "12px", lineHeight: 1.45 }}>
            {message}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "4px" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "6px 12px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "8px",
              color: "var(--tx-mut)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--tx-1)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--tx-mut)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "6px 12px",
              background: danger ? "#ef4444" : "var(--accent)",
              border: "1px solid rgba(0, 0, 0, 0.2)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: danger ? "0 2px 8px rgba(239, 68, 68, 0.35)" : "0 2px 8px rgba(60, 131, 245, 0.35)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

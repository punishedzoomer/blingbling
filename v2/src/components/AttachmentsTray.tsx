import { X, Plus, Scissors, FileText, FileCode, FileType, File } from "lucide-react";
import { Attachment, formatFileSize } from "../utils/fileProcessor";

interface AttachmentsTrayProps {
  attachments: Attachment[];
  pendingSnips: string[];
  onRemoveAttachment: (id: string) => void;
  onRemoveSnip: (index: number) => void;
  onPreviewImage: (url: string) => void;
  onAddSnip: () => void;
  onOpenFilePicker: () => void;
  disabled?: boolean;
}

function getFileIcon(name: string, mimeType?: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || mimeType === "application/pdf") {
    return <FileType size={16} color="#ef4444" />;
  }
  if (["ts", "tsx", "js", "jsx", "rs", "py", "c", "cpp", "h", "java", "go", "swift", "kt", "html", "css", "json", "toml", "yaml", "yml", "sql", "sh"].includes(ext)) {
    return <FileCode size={16} color="var(--accent)" />;
  }
  if (["md", "markdown", "txt", "rtf", "doc", "docx", "csv"].includes(ext)) {
    return <FileText size={16} color="#10b981" />;
  }
  return <File size={16} color="var(--tx-2)" />;
}

export function AttachmentsTray({
  attachments,
  pendingSnips,
  onRemoveAttachment,
  onRemoveSnip,
  onPreviewImage,
  onAddSnip,
  onOpenFilePicker,
  disabled = false,
}: AttachmentsTrayProps) {
  const hasItems = attachments.length > 0 || pendingSnips.length > 0;
  if (!hasItems) return null;

  return (
    <div
      className="attachments-tray"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
        overflowY: "hidden",
        maxWidth: "100%",
        scrollbarWidth: "none",
      }}
    >
      {/* Legacy/extension snips */}
      {pendingSnips.map((snip, idx) => (
        <div
          key={`snip-${idx}`}
          style={{
            position: "relative",
            flexShrink: 0,
            cursor: "zoom-in",
            borderRadius: "8px",
            overflow: "visible",
          }}
          onClick={() => onPreviewImage(snip)}
          title="Click to zoom snip"
        >
          <img
            src={snip}
            style={{
              height: "54px",
              width: "auto",
              maxWidth: "100px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "block",
              background: "rgba(0,0,0,0.3)",
            }}
            alt="Screen snip"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveSnip(idx);
            }}
            disabled={disabled}
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              background: "#ef4444",
              color: "white",
              border: "1px solid rgba(0,0,0,0.3)",
              borderRadius: "50%",
              width: "18px",
              height: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(0,0,0,0.4)",
              zIndex: 2,
              padding: 0,
            }}
            title="Remove snip"
          >
            <X size={11} />
          </button>
        </div>
      ))}

      {/* Rich attachments (images & files) */}
      {attachments.map((att) => {
        if (att.type === "image") {
          return (
            <div
              key={att.id}
              style={{
                position: "relative",
                flexShrink: 0,
                cursor: "zoom-in",
                borderRadius: "8px",
                overflow: "visible",
              }}
              onClick={() => onPreviewImage(att.content)}
              title={`${att.name} (${formatFileSize(att.size)})`}
            >
              <img
                src={att.previewUrl || att.content}
                style={{
                  height: "54px",
                  width: "auto",
                  maxWidth: "100px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "block",
                  background: "rgba(0,0,0,0.3)",
                }}
                alt={att.name}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAttachment(att.id);
                }}
                disabled={disabled}
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "#ef4444",
                  color: "white",
                  border: "1px solid rgba(0,0,0,0.3)",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.4)",
                  zIndex: 2,
                  padding: 0,
                }}
                title="Remove image"
              >
                <X size={11} />
              </button>
            </div>
          );
        }

        // Document / Code / PDF file pill
        return (
          <div
            key={att.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              flexShrink: 0,
              maxWidth: "180px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
            title={`${att.name} (${formatFileSize(att.size)})`}
          >
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
              {getFileIcon(att.name, att.mimeType)}
            </div>
            <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--tx-1)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {att.name}
              </span>
              <span style={{ fontSize: "10px", color: "var(--tx-mut)" }}>
                {formatFileSize(att.size)}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveAttachment(att.id);
              }}
              disabled={disabled}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "none",
                borderRadius: "50%",
                width: "18px",
                height: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--tx-mut)",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--tx-mut)";
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
              title="Remove file"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}

      {/* Add buttons in tray */}
      <div style={{ display: "flex", gap: "6px", flexShrink: 0, marginLeft: "4px" }}>
        <button
          onClick={onOpenFilePicker}
          disabled={disabled}
          style={{
            height: "54px",
            padding: "0 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.2)",
            borderRadius: "8px",
            cursor: "pointer",
            color: "var(--tx-mut)",
            gap: "3px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            e.currentTarget.style.color = "var(--tx-mut)";
          }}
          title="Attach file"
        >
          <Plus size={14} />
          <span style={{ fontSize: "10px", fontWeight: 500 }}>File</span>
        </button>

        <button
          onClick={onAddSnip}
          disabled={disabled}
          style={{
            height: "54px",
            padding: "0 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.2)",
            borderRadius: "8px",
            cursor: "pointer",
            color: "var(--tx-mut)",
            gap: "3px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            e.currentTarget.style.color = "var(--tx-mut)";
          }}
          title="Take snip"
        >
          <Scissors size={14} />
          <span style={{ fontSize: "10px", fontWeight: 500 }}>Snip</span>
        </button>
      </div>
    </div>
  );
}

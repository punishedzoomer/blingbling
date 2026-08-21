import { useLayoutEffect, useRef } from "react";
import { Pencil, FileText, ChevronDown, FileCode, FileType } from "lucide-react";
import { MessageRenderer } from "./MarkdownRenderer";
import { Attachment, formatFileSize } from "../utils/fileProcessor";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  contextText?: string;
  contextImages?: string[];
  attachments?: Attachment[];
}

interface MessageListProps {
  messages: Message[];
  showContextState: { [key: number]: boolean };
  setShowContextState: React.Dispatch<React.SetStateAction<{ [key: number]: boolean }>>;
  setInput: (val: string) => void;
  setPendingContextText: (text: string) => void;
  setPendingSnips: (snips: string[]) => void;
  setAttachments?: (attachments: Attachment[]) => void;
  setPreviewImage: (url: string | null) => void;
  isThinking: boolean;
}

function getFileIcon(name: string, mimeType?: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || mimeType === "application/pdf") {
    return <FileType size={14} color="#ef4444" />;
  }
  if (["ts", "tsx", "js", "jsx", "rs", "py", "c", "cpp", "h", "java", "go", "swift", "kt", "html", "css", "json", "toml", "yaml", "yml", "sql", "sh"].includes(ext)) {
    return <FileCode size={14} color="var(--accent)" />;
  }
  return <FileText size={14} color="#10b981" />;
}

export function MessageList({
  messages,
  showContextState,
  setShowContextState,
  setInput,
  setPendingContextText,
  setPendingSnips,
  setAttachments,
  setPreviewImage,
  isThinking,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Instantly place the user at the bottom of the conversation without animation jump
  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isThinking]);

  return (
    <div id="messages" ref={containerRef}>
      {messages.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--tx-mut)" }}>
          <h3 style={{ color: "var(--tx-1)", fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
            Hi There!
          </h3>
          <p style={{ fontSize: "13px", lineHeight: 1.5 }}>
            How can I help you today? Try taking a snip, attaching a file, or asking a question.
          </p>
        </div>
      )}

      {messages.map((msg, idx) => {
        const hasContext = Boolean(
          msg.contextText ||
          (msg.contextImages && msg.contextImages.length > 0) ||
          (msg.attachments && msg.attachments.length > 0)
        );

        const attachmentsCount = (msg.attachments?.length || 0) + (msg.contextImages?.length || 0);

        return (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              width: "100%",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div className={msg.role === "user" ? "user-bubble" : "ai-text small"}>
              {msg.role === "user" ? (
                <div>{msg.content}</div>
              ) : (
                <MessageRenderer content={msg.content} />
              )}
            </div>

            {msg.role === "user" && (
              <div
                style={{
                  alignSelf: "flex-end",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", gap: "6px", marginBottom: showContextState[idx] ? "8px" : "0" }}>
                  <button
                    onClick={() => {
                      setInput(msg.content === "(Sent snip)" || msg.content === "(Sent attachment)" ? "" : msg.content);
                      setPendingContextText(msg.contextText || "");
                      setPendingSnips(msg.contextImages ? [...msg.contextImages] : []);
                      if (setAttachments && msg.attachments) {
                        setAttachments([...msg.attachments]);
                      }
                    }}
                    className="smart-pill"
                    style={{
                      opacity: 0.6,
                      background: "rgba(255, 255, 255, 0.05)",
                      borderColor: "transparent",
                      color: "var(--tx-mut)",
                    }}
                    title="Edit Prompt"
                  >
                    <span className="ic">
                      <Pencil size={12} />
                    </span>
                  </button>

                  {hasContext && (
                    <button
                      onClick={() => setShowContextState((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="smart-pill"
                      style={{
                        opacity: 0.7,
                        background: "rgba(255, 255, 255, 0.05)",
                        borderColor: "transparent",
                        color: "var(--tx-mut)",
                      }}
                    >
                      <span className="ic">
                        <FileText size={12} />
                      </span>
                      <span>
                        {attachmentsCount > 0
                          ? `Context (${attachmentsCount} item${attachmentsCount > 1 ? "s" : ""})`
                          : "View Context"}
                      </span>
                      <span
                        className="ic"
                        style={{
                          marginLeft: "4px",
                          transform: showContextState[idx] ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s",
                        }}
                      >
                        <ChevronDown size={12} />
                      </span>
                    </button>
                  )}
                </div>

                {showContextState[idx] && hasContext && (
                  <div
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      maxWidth: "92%",
                      width: "100%",
                      alignSelf: "flex-end",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                    }}
                  >
                    {/* Rich Attached Files list */}
                    {msg.attachments && msg.attachments.filter((a) => a.type === "file").length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                        {msg.attachments
                          .filter((a) => a.type === "file")
                          .map((att) => (
                            <div
                              key={att.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 8px",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "6px",
                                fontSize: "11px",
                                color: "var(--tx-1)",
                              }}
                            >
                              {getFileIcon(att.name, att.mimeType)}
                              <span style={{ fontWeight: 600 }}>{att.name}</span>
                              <span style={{ color: "var(--tx-mut)", fontSize: "10px" }}>
                                ({formatFileSize(att.size)})
                              </span>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Text / Context Content */}
                    {msg.contextText && (
                      <pre
                        style={{
                          marginBottom:
                            (msg.contextImages?.length || 0) + (msg.attachments?.filter((a) => a.type === "image").length || 0) > 0
                              ? "12px"
                              : 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: "11px",
                          color: "var(--tx-2)",
                          fontFamily: "monospace",
                          maxHeight: "160px",
                          overflowY: "auto",
                          background: "rgba(0,0,0,0.2)",
                          padding: "8px",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        {msg.contextText}
                      </pre>
                    )}

                    {/* Attached Images & Snips */}
                    {((msg.contextImages && msg.contextImages.length > 0) ||
                      (msg.attachments && msg.attachments.some((a) => a.type === "image"))) && (
                      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                        {msg.contextImages?.map((img, i) => (
                          <div
                            key={`legacy-img-${i}`}
                            style={{ flexShrink: 0, cursor: "zoom-in" }}
                            onClick={() => setPreviewImage(img)}
                            title="Click to enlarge"
                          >
                            <img
                              src={img}
                              style={{
                                height: "48px",
                                borderRadius: "6px",
                                border: "1px solid rgba(255,255,255,0.12)",
                              }}
                              alt="Context snip"
                            />
                          </div>
                        ))}
                        {msg.attachments
                          ?.filter((a) => a.type === "image")
                          .map((att) => (
                            <div
                              key={att.id}
                              style={{ flexShrink: 0, cursor: "zoom-in" }}
                              onClick={() => setPreviewImage(att.previewUrl || att.content)}
                              title={`${att.name} (click to enlarge)`}
                            >
                              <img
                                src={att.previewUrl || att.content}
                                style={{
                                  height: "48px",
                                  borderRadius: "6px",
                                  border: "1px solid rgba(255,255,255,0.12)",
                                }}
                                alt={att.name}
                              />
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isThinking && (
        <div className="ai-text small text-gray-400 italic flex items-center gap-2 px-3 py-2">
          <span className="animate-pulse">Thinking...</span>
        </div>
      )}
    </div>
  );
}

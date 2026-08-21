import { Zap, Sparkles, Flame, ChevronDown, Scissors, Monitor, History, Plus, Settings, Square, ArrowUp, Paperclip } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface ComposerBottomProps {
  aiMode: "quick" | "smart" | "ultra";
  setAiMode: (mode: "quick" | "smart" | "ultra") => void;
  showModeDropdown: boolean;
  setShowModeDropdown: (show: boolean) => void;
  pendingSnips: string[];
  attachments?: any[];
  totalAttachmentsCount?: number;
  showSnipsTray: boolean;
  setShowSnipsTray: (show: boolean) => void;
  handleSnip: (interactive?: boolean) => void;
  onOpenFilePicker?: () => void;
  isCapturing: boolean;
  isStreaming: boolean;
  setSessionId: (id: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setInput: (val: string) => void;
  clearAllAttachments?: () => void;
  setPendingSnips: (snips: string[]) => void;
  setPendingContextText: (text: string) => void;
  setActiveTagId: (id: string | null) => void;
  setSessionTitle: (title: string | null) => void;
  handleSend: () => void;
  input: string;
}

export function ComposerBottom({
  aiMode,
  setAiMode,
  showModeDropdown,
  setShowModeDropdown,
  pendingSnips,
  attachments = [],
  totalAttachmentsCount = 0,
  showSnipsTray,
  setShowSnipsTray,
  handleSnip,
  onOpenFilePicker,
  isCapturing,
  isStreaming,
  setSessionId,
  setMessages,
  setInput,
  clearAllAttachments,
  setPendingSnips,
  setPendingContextText,
  setActiveTagId,
  setSessionTitle,
  handleSend,
  input,
}: ComposerBottomProps) {
  const count = totalAttachmentsCount > 0 ? totalAttachmentsCount : (pendingSnips.length + attachments.length);

  return (
    <div id="composer-bottom">
      <div style={{ position: "relative" }}>
        <button
          id="ai-mode-toggle"
          className="smart-pill"
          disabled={isStreaming}
          onClick={() => setShowModeDropdown(!showModeDropdown)}
          title="Select AI Mode"
        >
          <span className="ic">
            {aiMode === "quick" && <Zap size={14} />}
            {aiMode === "smart" && <Sparkles size={14} />}
            {aiMode === "ultra" && <Flame size={14} />}
          </span>
          <span>
            {aiMode === "quick" && "Quick"}
            {aiMode === "smart" && "Smart"}
            {aiMode === "ultra" && "Ultra"}
          </span>
          <span className="ic" style={{ marginLeft: "2px" }}>
            <ChevronDown size={14} />
          </span>
        </button>

        {showModeDropdown && (
          <>
            <div
              style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
              onClick={() => setShowModeDropdown(false)}
            />
            <div className="mode-menu">
              {aiMode !== "quick" && (
                <button
                  className="mode-menu-item"
                  onClick={() => {
                    setAiMode("quick");
                    setShowModeDropdown(false);
                  }}
                >
                  <Zap size={14} /> Quick
                </button>
              )}
              {aiMode !== "smart" && (
                <button
                  className="mode-menu-item"
                  onClick={() => {
                    setAiMode("smart");
                    setShowModeDropdown(false);
                  }}
                >
                  <Sparkles size={14} /> Smart
                </button>
              )}
              {aiMode !== "ultra" && (
                <button
                  className="mode-menu-item"
                  onClick={() => {
                    setAiMode("ultra");
                    setShowModeDropdown(false);
                  }}
                >
                  <Flame size={14} /> Ultra
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Attach File Button */}
      <button
        id="attach-file-btn"
        className="smart-pill"
        title="Attach File (PDF, Code, Markdown, Image)"
        onClick={() => {
          if (count > 0) {
            setShowSnipsTray(!showSnipsTray);
          } else if (onOpenFilePicker) {
            onOpenFilePicker();
          }
        }}
        disabled={isStreaming}
        style={{
          marginLeft: "8px",
          color: count > 0 ? "var(--accent)" : undefined,
          borderColor: count > 0 ? "color-mix(in srgb, var(--accent) 30%, transparent)" : undefined,
        }}
      >
        <span className="ic">
          <Paperclip size={14} />
        </span>
        <span>{count > 0 ? `${count}` : "Attach"}</span>
      </button>

      {/* Interactive Region Snip */}
      <button
        id="snip-interactive-btn"
        className="smart-pill"
        title="Snip Region"
        onClick={() => {
          if (count > 0 && !showSnipsTray) {
            setShowSnipsTray(true);
          }
          handleSnip(true);
        }}
        disabled={isCapturing || isStreaming}
        style={{ marginLeft: "4px" }}
      >
        <span className="ic">
          <Scissors size={14} />
        </span>
      </button>

      {/* Full Screen Snip */}
      <button
        id="snip-full-btn"
        className="smart-pill"
        title="Capture Entire Screen"
        onClick={() => handleSnip(false)}
        disabled={isCapturing || isStreaming}
        style={{ marginLeft: "4px" }}
      >
        <span className="ic">
          <Monitor size={14} />
        </span>
      </button>

      {/* History Window Toggle */}
      <button
        id="history-btn"
        className="history-btn"
        title="View conversation history"
        disabled={isStreaming}
        onClick={async () => {
          await invoke("show_panel", { label: "history" }).catch(() => {
            alert("Could not open History window. Please restart the app for the multi-window update to take effect!");
          });
        }}
        style={{ marginLeft: "4px" }}
      >
        <span className="ic">
          <History size={16} />
        </span>
      </button>

      {/* New Chat Button */}
      <button
        id="new-chat-btn"
        className="history-btn"
        title="New Chat"
        disabled={isStreaming}
        onClick={() => {
          setSessionId(Date.now().toString());
          setMessages([]);
          setInput("");
          if (clearAllAttachments) {
            clearAllAttachments();
          } else {
            setPendingSnips([]);
            setPendingContextText("");
          }
          setActiveTagId(null);
          setSessionTitle(null);
        }}
        style={{ marginLeft: "4px" }}
      >
        <span className="ic">
          <Plus size={16} />
        </span>
      </button>

      {/* Settings Window Toggle */}
      <button
        id="more-btn"
        className="more-btn"
        title="Settings"
        disabled={isStreaming}
        onClick={async () => {
          await invoke("show_panel", { label: "settings" }).catch(() => {
            alert("Could not open Settings window. Please restart the app!");
          });
        }}
      >
        <span className="ic">
          <Settings size={16} />
        </span>
      </button>

      <div className="spacer"></div>

      {/* Send / Stop Button */}
      <button
        id="send-btn"
        title={isStreaming ? "Stop" : "Send"}
        onClick={
          isStreaming
            ? async () => {
                await invoke("cancel_ai_response");
              }
            : handleSend
        }
        disabled={!isStreaming && !input.trim() && count === 0}
      >
        {isStreaming ? <Square size={14} fill="currentColor" /> : <ArrowUp size={16} />}
      </button>
    </div>
  );
}

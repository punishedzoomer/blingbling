import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { X } from "lucide-react";
import "katex/dist/katex.min.css";
import "./App.css";

import { Toolbar } from "./components/Toolbar";
import { MessageList } from "./components/MessageList";
import { ComposerBottom } from "./components/ComposerBottom";
import { ActionButtons } from "./components/ActionButtons";
import { InputArea } from "./components/InputArea";
import { AttachmentsTray } from "./components/AttachmentsTray";
import { DropZoneOverlay } from "./components/DropZoneOverlay";
import { ImagePreviewModal } from "./components/ImagePreviewModal";

import { useDynamicBounds } from "./useDynamicBounds";
import { useAttachments } from "./hooks/useAttachments";
import { Attachment } from "./utils/fileProcessor";
import { getNotebookTagById } from "./utils/notebookTags";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  contextText?: string;
  contextImages?: string[];
  attachments?: Attachment[];
}

function App({ isWindowed = false, windowLabel = "main" }: { isWindowed?: boolean, windowLabel?: string } = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showContextState, setShowContextState] = useState<{ [key: number]: boolean }>({});
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const [tags, setTags] = useState<any[]>(() => {
    const saved = localStorage.getItem("customTags");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [activeNotebookId, setActiveNotebookId] = useState<number | null>(null);

  const [aiMode, setAiMode] = useState<"quick" | "smart" | "ultra">(() => {
    return (localStorage.getItem("aiMode") as any) || "smart";
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Unified attachments hook
  const {
    attachments,
    setAttachments,
    pendingSnips,
    setPendingSnips,
    setPendingContextText,
    isDragging,
    previewImage,
    setPreviewImage,
    showTray,
    setShowTray,
    fileInputRef,
    totalAttachmentsCount,
    addSnip,
    removeAttachment,
    removeSnip,
    clearAllAttachments,
    triggerFilePicker,
    handleFileInputChange,
    handlePaste,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    buildSendPayload,
  } = useAttachments();

  useDynamicBounds(windowLabel, !isWindowed);

  useEffect(() => {
    if (windowLabel === "main" && !isWindowed) {
      setTimeout(() => {
        if (!isCollapsed) {
          invoke("show_panel", { label: "chat-panel" });
        } else {
          invoke("hide_panel", { label: "chat-panel" });
        }
      }, 100);
    }
  }, []);

  // When switching from windowed to widget mode, the main pill is already mounted
  // so the initial startup effect doesn't run. We must sync the chat-panel here.
  useEffect(() => {
    if (windowLabel === "main") {


      let unlistenPromise: Promise<() => void>;
      let unlistenSyncPromise: Promise<() => void>;
      let timer: any;
      
      unlistenPromise = listen("app-mode-changed", (event: any) => {
        if (timer) clearTimeout(timer);
        if (event.payload === "widget") {
          timer = setTimeout(() => {
            if (!isCollapsed) {
              invoke("show_panel", { label: "chat-panel" });
            } else {
              invoke("hide_panel", { label: "chat-panel" });
            }
          }, 150);
        }
      });
      
      unlistenSyncPromise = listen("sync-chat-panel", () => {
        if (!isCollapsed) {
          invoke("show_panel", { label: "chat-panel" });
        } else {
          invoke("hide_panel", { label: "chat-panel" });
        }
      });

      return () => {
        unlistenPromise.then((f) => f());
        unlistenSyncPromise.then((f) => f());
        if (timer) clearTimeout(timer);
      };
    }
  }, [windowLabel, isCollapsed]);

  useEffect(() => {
    localStorage.setItem("aiMode", aiMode);
  }, [aiMode]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === "customTags" || e.key === "customWorkflows") && e.newValue) {
        try {
          setTags(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!isCollapsed) {
      document.getElementById("app")?.classList.remove("collapsed-mode");
      if (!isWindowed && windowLabel === "main") {
        invoke("show_panel", { label: "chat-panel" });
      }
    } else {
      document.getElementById("app")?.classList.add("collapsed-mode");
      if (!isWindowed && windowLabel === "main") {
        invoke("hide_panel", { label: "chat-panel" });
      }
    }
  }, [isCollapsed, isWindowed, windowLabel]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  // Sync messages to History window and backend when idle (not actively streaming)
  useEffect(() => {
    if (isStreaming) return;
    if (messages.length > 0) {
      invoke("save_session", {
        sessionId,
        data: { history: messages, tagId: activeTagId, notebookId: activeNotebookId, title: sessionTitle },
      })
        .then(() => {
          emit("history-sync", null);
        })
        .catch(console.error);
    }
  }, [isStreaming, messages, sessionId, sessionTitle, activeTagId, activeNotebookId]);

  // Auto-generate session title after first assistant response
  useEffect(() => {
    if (!isStreaming && messages.length >= 2 && !sessionTitle) {
      const generate = async () => {
        try {
          const apiKey = localStorage.getItem("openRouterKey");
          if (!apiKey) return;
          const model = localStorage.getItem("modelQuick") || "openai/gpt-4o-mini";
          const title = await invoke("generate_title", { apiKey, model, messages });
          setSessionTitle(title as string);
        } catch (e) {
          console.error("Failed to generate title", e);
        }
      };
      generate();
    }
  }, [isStreaming, messages.length, sessionTitle]);

  const addSnipRef = useRef(addSnip);
  const setPendingContextTextRef = useRef(setPendingContextText);
  const clearAllAttachmentsRef = useRef(clearAllAttachments);

  useEffect(() => {
    addSnipRef.current = addSnip;
    setPendingContextTextRef.current = setPendingContextText;
    clearAllAttachmentsRef.current = clearAllAttachments;
  });

  // Listen for actions from other windows and extension
  useEffect(() => {
    let unlistenClear: any, unlistenSimulate: any, unlistenAddMsg: any, unlistenRestore: any, unlistenReset: any;

    listen("clear-history", () => {
      setMessages([]);
      setInput("");
      setActiveTagId(null);
      setActiveNotebookId(null);
      setSessionTitle(null);
      clearAllAttachmentsRef.current();
      setIsStreaming(false);
      setIsThinking(false);
    }).then((f) => (unlistenClear = f));

    const handleAppReset = () => {
      setSessionId(Date.now().toString());
      setMessages([]);
      setInput("");
      setActiveTagId(null);
      setActiveNotebookId(null);
      setSessionTitle(null);
      clearAllAttachmentsRef.current();
      setIsStreaming(false);
      setIsThinking(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };

    window.addEventListener("app-reset-session", handleAppReset);
    listen("reset-session", handleAppReset).then((f) => (unlistenReset = f));

    listen("add-message", (e: any) => setMessages((prev) => [...prev, e.payload])).then(
      (f) => (unlistenAddMsg = f)
    );

    const applyRestoreSession = (payload: any) => {
      if (!payload) return;
      const { id, data, tagId, notebookId, title } = payload;
      try {
        const savedTags = localStorage.getItem("customTags");
        if (savedTags) {
          setTags(JSON.parse(savedTags));
        }
      } catch (err) {
        console.error("Failed to reload tags on restore-session", err);
      }
      setSessionId(id || Date.now().toString());
      setMessages(data || []);
      setInput("");

      let resolvedTagId = tagId || null;
      if (notebookId) {
        const nbTag = getNotebookTagById(notebookId);
        if (nbTag) {
          resolvedTagId = nbTag.id;
        }
      }
      setActiveTagId(resolvedTagId);
      setActiveNotebookId(notebookId || null);
      setSessionTitle(title || null);
      clearAllAttachmentsRef.current();
      setIsStreaming(false);
      setIsThinking(false);
      setIsCollapsed(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const handleCustomRestore = (e: any) => {
      applyRestoreSession(e.detail);
    };
    window.addEventListener("app-restore-session", handleCustomRestore);

    listen("restore-session", (e: any) => {
      applyRestoreSession(e.payload);
    }).then((f) => (unlistenRestore = f));

    let unlistenExpand: (() => void) | null = null;
    listen("expand-chat", () => {
      setIsCollapsed(false);
    }).then((f) => (unlistenExpand = f));

    listen("simulate-llm", async () => {
      const mockResponse = `### LLM Mock Response\nHere is a test of **Markdown parsing**:\n1. Supports code & attachments\n\`\`\`rust\nfn main() {\n    println!("Hello, BlingBling!");\n}\n\`\`\`\nWorks cleanly!`;
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      const chunks = mockResponse.split(/(?=\s)/);
      for (let i = 0; i < chunks.length; i++) {
        await new Promise((r) => setTimeout(r, 40));
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          lastMsg.content += chunks[i];
          return newMessages;
        });
      }
    }).then((f) => (unlistenSimulate = f));

    return () => {
      window.removeEventListener("app-reset-session", handleAppReset);
      window.removeEventListener("app-restore-session", handleCustomRestore);
      if (unlistenClear) unlistenClear();
      if (unlistenAddMsg) unlistenAddMsg();
      if (unlistenSimulate) unlistenSimulate();
      if (unlistenRestore) unlistenRestore();
      if (unlistenReset) unlistenReset();
      if (unlistenExpand) unlistenExpand();
    };
  }, []);

  // AI response streaming & extension snip listeners
  useEffect(() => {
    const unlistenAi = listen<string>("ai-response", (event) => {
      const chunk = event.payload;
      if (chunk === "[DONE]") {
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      setIsThinking(false);
      setIsStreaming(true);

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content += chunk;
        } else {
          newMessages.push({ role: "assistant", content: chunk });
        }
        return newMessages;
      });
    });

    const unlistenSnip = listen<string>("extension-snip-received", (event) => {
      try {
        const payload = JSON.parse(event.payload);
        if (payload.image) {
          addSnipRef.current(payload.image);
        }
        if (payload.extraImages && payload.extraImages.length > 0) {
          for (const img of payload.extraImages) {
            addSnipRef.current(img);
          }
        }
        if (payload.text) {
          setPendingContextTextRef.current(payload.text);
        }
      } catch {
        addSnipRef.current(event.payload);
      }
      invoke("show_panel", { label: "main" });
    });

    return () => {
      unlistenAi.then((f) => f());
      unlistenSnip.then((f) => f());
    };
  }, []);

  const handleSnip = async (interactive: boolean = false) => {
    setIsCapturing(true);
    let wasHidden = false;

    try {
      if (interactive) {
        await invoke("hide_panel", { label: "main" });
        wasHidden = true;
        await new Promise((r) => setTimeout(r, 100));
      }

      let base64Img = "";
      if (interactive) {
        base64Img = await invoke<string>("capture_screen_interactive");
      } else {
        base64Img = await invoke<string>("capture_screen");
      }
      addSnip(base64Img);
    } catch (captureErr) {
      console.error("Capture failed:", captureErr);
      if (!interactive) {
        alert("Screen capture failed! Please make sure crackit has Screen Recording permissions in macOS System Settings > Privacy & Security.");
      }
    } finally {
      if (wasHidden) {
        await invoke("show_panel", { label: "main" });
      }
      setIsCapturing(false);
    }
  };

  const activeTag = tags.find((t) => t.id === activeTagId);
  const isNotebookChat = Boolean(activeNotebookId || activeTag?.notebookId);

  useEffect(() => {
    if (activeNotebookId) {
      const nbTag = getNotebookTagById(activeNotebookId);
      if (nbTag && activeTagId !== nbTag.id) {
        setActiveTagId(nbTag.id);
      }
    }
  }, [activeNotebookId, activeTagId]);

  const handleSend = async () => {
    let userMsg = input.trim();

    // Check if user submitted a tag command
    const tagMatch = userMsg.match(/^\/(?:tag|t)\s+#?([a-zA-Z0-9_\-\.]+)(?:\s+(.*)|$)/is);
    if (tagMatch) {
      const tagName = tagMatch[1].replace(/^#+/, "").trim();
      const remaining = (tagMatch[2] || "").trim();

      if (!isNotebookChat && tagName) {
        let existingTag = tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
        if (!existingTag) {
          existingTag = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            name: tagName,
            color: `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`,
          };
          const newTags = [...tags, existingTag];
          setTags(newTags);
          localStorage.setItem("customTags", JSON.stringify(newTags));
          emit("history-sync", null).catch(() => {});
        }
        setActiveTagId(existingTag.id);
      }
      userMsg = remaining;
    }

    if (isStreaming || (!userMsg && totalAttachmentsCount === 0)) {
      if (tagMatch && !userMsg && totalAttachmentsCount === 0) {
        setInput("");
      }
      return;
    }

    const payload = buildSendPayload(userMsg);

    const userMessageRecord: Message = {
      role: "user",
      content: userMsg || (payload.images.length > 0 ? "(Sent snip)" : "(Sent attachment)"),
      contextText: payload.contextText || undefined,
      contextImages: payload.images.length > 0 ? payload.images : undefined,
      attachments: payload.attachmentsSnapshot.length > 0 ? payload.attachmentsSnapshot : undefined,
    };

    const assistantPlaceholder: Message = {
      role: "assistant",
      content: "",
    };

    const updatedMessages = [...messages, userMessageRecord, assistantPlaceholder];
    setMessages(updatedMessages);
    setInput("");
    clearAllAttachments();
    setIsThinking(true);
    setIsStreaming(true);

    invoke("save_session", {
      sessionId,
      data: { history: [...messages, userMessageRecord], tagId: activeTagId, notebookId: activeNotebookId, title: sessionTitle || userMsg.slice(0, 60) },
    }).catch(console.error);

    try {
      const previousMessages = messages.map((m) => {
        let textContent = m.content;
        if (m.contextText) {
          textContent += `\n\n<context>\n${m.contextText}\n</context>`;
        }
        return {
          role: m.role,
          content: m.contextImages
            ? [
                { type: "text", text: textContent },
                ...m.contextImages.map((img: string) => ({ type: "image_url", image_url: { url: img } })),
              ]
            : textContent,
        };
      });

      const currentMessage =
        payload.contentArray.length > 0 && typeof payload.contentArray[0] === "object"
          ? { role: "user", content: payload.contentArray }
          : { role: "user", content: userMsg };

      const messagesPayload = [
        {
          role: "system",
          content: "You are a helpful, elite AI assistant. Always provide clean, optimal, and flawless answers.",
        },
        ...previousMessages,
        currentMessage,
      ];

      await invoke("stream_ai_response", {
        apiKey: localStorage.getItem("openRouterKey") || "",
        model:
          localStorage.getItem(
            aiMode === "quick" ? "modelQuick" : aiMode === "smart" ? "modelSmart" : "modelUltra"
          ) ||
          (aiMode === "quick"
            ? "openai/gpt-4o-mini"
            : aiMode === "smart"
            ? "anthropic/claude-3.5-sonnet"
            : "deepseek/deepseek-reasoner"),
        messages: messagesPayload,
      });
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "**Error:** " + e }]);
      setIsThinking(false);
      setIsStreaming(false);
    }
  };

  const sendPreset = async (msg: string) => {
    if (isStreaming) return;

    if (totalAttachmentsCount === 0 && (msg === "Help me with what's on my screen" || msg === "What should I say right now?")) {
      try {
        const base64Img = await invoke<string>("capture_screen");
        addSnip(base64Img);
      } catch (err) {
        console.error("Auto screen capture failed:", err);
      }
    }

    setInput(msg);
  };

  return (
    <div
      id="app"
      className={`${isWindowed ? "windowed-app" : ""} ${windowLabel === "chat-panel" ? "is-chat-panel" : ""}`.trim()}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!isWindowed && windowLabel === "main" && <Toolbar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}

      {(isWindowed || windowLabel === "chat-panel") && (
        <div id="panel-wrap" className={isWindowed ? "windowed-panel-wrap" : undefined}>
          <div id="panel" className={`${isWindowed ? "windowed-panel" : "glass"} no-drag`}>
            <div id="panel-columns">
            <div id="panel-main" style={{ position: "relative" }}>
              <DropZoneOverlay isDragging={isDragging} />

              <MessageList
                messages={messages}
                showContextState={showContextState}
                setShowContextState={setShowContextState}
                setInput={setInput}
                setPendingContextText={setPendingContextText}
                setPendingSnips={setPendingSnips}
                setAttachments={setAttachments}
                setPreviewImage={setPreviewImage}
                isThinking={isThinking}
              />

              <ActionButtons isStreaming={isStreaming} sendPreset={sendPreset} />

              <div id="composer" style={{ opacity: isStreaming ? 0.6 : 1 }}>
                {showTray && totalAttachmentsCount > 0 && (
                  <AttachmentsTray
                    attachments={attachments}
                    pendingSnips={pendingSnips}
                    onRemoveAttachment={removeAttachment}
                    onRemoveSnip={removeSnip}
                    onPreviewImage={setPreviewImage}
                    onAddSnip={() => handleSnip(true)}
                    onOpenFilePicker={triggerFilePicker}
                    disabled={isStreaming}
                  />
                )}

                <InputArea
                  input={input}
                  setInput={setInput}
                  isStreaming={isStreaming}
                  textareaRef={textareaRef}
                  handleSend={handleSend}
                  tags={tags}
                  setTags={setTags}
                  activeTagId={activeTagId}
                  setActiveTagId={setActiveTagId}
                  isNotebookChat={isNotebookChat}
                  onPaste={async (e) => {
                    const handled = await handlePaste(e);
                    if (handled) {
                      e.preventDefault();
                    }
                  }}
                />

                <ComposerBottom
                  aiMode={aiMode}
                  setAiMode={setAiMode}
                  showModeDropdown={showModeDropdown}
                  setShowModeDropdown={setShowModeDropdown}
                  pendingSnips={pendingSnips}
                  attachments={attachments}
                  totalAttachmentsCount={totalAttachmentsCount}
                  showSnipsTray={showTray}
                  setShowSnipsTray={setShowTray}
                  handleSnip={handleSnip}
                  onOpenFilePicker={triggerFilePicker}
                  isCapturing={isCapturing}
                  isStreaming={isStreaming}
                  setSessionId={setSessionId}
                  setMessages={setMessages}
                  setInput={setInput}
                  clearAllAttachments={clearAllAttachments}
                  setPendingSnips={setPendingSnips}
                  setPendingContextText={setPendingContextText}
                  setActiveTagId={setActiveTagId}
                  setSessionTitle={setSessionTitle}
                  handleSend={handleSend}
                  input={input}
                />
              </div>

              {activeTag && (
                <div className="active-tag-bar">
                  <div
                    className="active-tag-chip"
                    style={{
                      borderColor: `color-mix(in srgb, ${activeTag.color} 45%, rgba(255,255,255,0.12))`,
                      paddingRight: isNotebookChat ? "10px" : "8px",
                    }}
                  >
                    <span className="tag-hash" style={{ color: activeTag.color }}>#</span>
                    <span className="tag-name" style={{ color: activeTag.color }}>{activeTag.name}</span>
                    {!isNotebookChat && (
                      <button
                        className="tag-remove-btn"
                        onClick={() => setActiveTagId(null)}
                        title="Remove Tag"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      <ImagePreviewModal previewImage={previewImage} onClose={() => setPreviewImage(null)} />

      {/* Hidden file input for file picker */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="image/*,.pdf,.md,.txt,.json,.csv,.py,.rs,.ts,.tsx,.js,.jsx,.html,.css,.yaml,.yml,.sh,.toml,.sql,.xml,.env,.log,.c,.cpp,.h,.java,.go,.swift"
        style={{ display: "none" }}
      />
    </div>
  );
}

export default App;

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useDynamicBounds } from "./useDynamicBounds";
import {
  ChevronDown, Square, X, MessageCircle, Wand, RefreshCw,
  MessageSquareText, Zap, Settings, History, ArrowUp, Scissors, Monitor, Sparkles, Flame, Plus
} from "lucide-react";
import "./App.css";

const LogoIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 12 6.5 8.2a6.6 6.6 0 0 1 5.5-2.9V12z" fill="currentColor" />
    <path d="M12 12 15.8 6.5a6.6 6.6 0 0 1 2.9 5.5H12z" fill="currentColor" opacity="0.72" />
    <path d="M12 12 17.5 15.8a6.6 6.6 0 0 1-5.5 2.9V12z" fill="currentColor" opacity="0.5" />
    <path d="M12 12 8.2 17.5a6.6 6.6 0 0 1-2.9-5.5H12z" fill="currentColor" opacity="0.85" />
  </svg>
);

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="relative group my-4 rounded-md overflow-hidden bg-[#1d1f21]">
        <div className="flex items-center justify-between px-4 py-1 bg-[#2d2f31] text-xs text-gray-400">
          <span>{match[1]}</span>
          <button onClick={handleCopy} className="hover:text-white transition-colors">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <SyntaxHighlighter
          style={atomDark as any}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, background: "transparent" }}
          {...props}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }
  return <code className="bg-black/10 rounded px-1 py-0.5 text-sm" {...props}>{children}</code>;
};

function App() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [input, setInput] = useState("");
  const [pendingSnips, setPendingSnips] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [aiMode, setAiMode] = useState<"quick" | "smart" | "ultra">(() => {
    return (localStorage.getItem("aiMode") as any) || "smart";
  });
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  useEffect(() => {
    localStorage.setItem("aiMode", aiMode);
  }, [aiMode]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync messages to History window and save to backend whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("save_session", { sessionId, data: messages }).catch(console.error);
      });
    }
    import("@tauri-apps/api/event").then(({ emit }) => {
      emit("history-sync", messages);
    });
  }, [messages, sessionId]);

  // Listen for actions from other windows
  useEffect(() => {
    let unlistenClear: any, unlistenSimulate: any, unlistenAddMsg: any, unlistenRestore: any;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("clear-history", () => setMessages([])).then(f => unlistenClear = f);
      listen("add-message", (e: any) => setMessages(prev => [...prev, e.payload])).then(f => unlistenAddMsg = f);
      listen("restore-session", (e: any) => {
        const { id, data } = e.payload;
        setSessionId(id);
        setMessages(data);
      }).then(f => unlistenRestore = f);
      listen("simulate-llm", async () => {
        const mockResponse = `### LLM Mock Response\nHere is a test of **Markdown parsing**:\n1. It supports lists\n2. It supports \`inline code\`\n\nAnd code blocks:\n\`\`\`rust\nfn main() {\n    println!("Hello, BlingBling!");\n}\n\`\`\`\nIt looks solid!`;
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        const chunks = mockResponse.split(/(?=\s)/);
        for (let i = 0; i < chunks.length; i++) {
          await new Promise(r => setTimeout(r, 40));
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            lastMsg.content += chunks[i];
            return newMessages;
          });
        }
      }).then(f => unlistenSimulate = f);
    });

    return () => {
      if (unlistenClear) unlistenClear();
      if (unlistenAddMsg) unlistenAddMsg();
      if (unlistenSimulate) unlistenSimulate();
      if (unlistenRestore) unlistenRestore();
    };
  }, []);

  useDynamicBounds("main");

  useEffect(() => {
    if (!isCollapsed) {
      document.getElementById('app')?.classList.remove('collapsed-mode');
    } else {
      document.getElementById('app')?.classList.add('collapsed-mode');
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
    }
  }, [input]);

  useEffect(() => {
    const unlisten = listen<string>("ai-response", (event) => {
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

    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleSnip = async (interactive: boolean = false) => {
    setIsCapturing(true);
    let wasHidden = false;

    try {
      if (interactive) {
        // Hide window so it doesn't get in the way of the crosshair selection
        await invoke("hide_panel", { label: "main" });
        wasHidden = true;
        // Small delay to allow window to fully hide before capturing
        await new Promise(r => setTimeout(r, 100));
      }

      let base64Img = "";
      if (interactive) {
        await invoke("start_interactive_snip");
        const { listen } = await import("@tauri-apps/api/event");
        base64Img = await new Promise<string>((resolve) => {
          const unlisten = listen<string>("snip_finished", (event) => {
            unlisten.then(f => f());
            resolve(event.payload);
          });
        });
        if (!base64Img) {
          throw new Error("Capture cancelled");
        }
      } else {
        base64Img = await invoke<string>("capture_screen");
      }
      setPendingSnips((prev) => [...prev, base64Img]);
    } catch (captureErr) {
      console.error("Capture failed:", captureErr);
      if (interactive) {
        // User probably pressed escape to cancel
        console.log("Interactive capture cancelled.");
      } else {
        alert("Screen capture failed! Please make sure crackit has Screen Recording permissions in macOS System Settings > Privacy & Security.");
      }
    } finally {
      if (wasHidden) {
        await invoke("show_panel", { label: "main" });
      }
      setIsCapturing(false);
    }
  };

  const handleSend = async () => {
    if (isStreaming || (!input.trim() && pendingSnips.length === 0)) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg || "(Sent snip)" }]);
    setInput("");

    const snipsToSend = [...pendingSnips];
    setPendingSnips([]);
    setIsThinking(true);
    setIsStreaming(true);

    try {
      let contentArray: any[] = [];
      if (userMsg) {
        contentArray.push({ type: "text", text: userMsg });
      }
      for (const snip of snipsToSend) {
        contentArray.push({ type: "image_url", image_url: { url: snip } });
      }

      const messagesPayload = contentArray.length > 0 && typeof contentArray[0] === 'object' ? [
        {
          role: "user",
          content: contentArray
        }
      ] : [
        {
          role: "user",
          content: userMsg
        }
      ];

      await invoke("stream_ai_response", {
        apiKey: localStorage.getItem("openRouterKey") || "",
        model: localStorage.getItem(
          aiMode === "quick" ? "modelQuick" :
            aiMode === "smart" ? "modelSmart" :
              "modelUltra"
        ) || (
            aiMode === "quick" ? "google/gemini-2.0-flash" :
              aiMode === "smart" ? "anthropic/claude-3.5-sonnet" :
                "deepseek/deepseek-reasoner"
          ),
        messages: messagesPayload
      });
    } catch (e) {
      console.error(e);
      alert("AI Request Failed: " + e);
      setIsThinking(false);
      setIsStreaming(false);
    }
  };

  const sendPreset = async (msg: string) => {
    if (isStreaming) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);

    let snipsToSend = [...pendingSnips];
    setPendingSnips([]);
    setIsThinking(true);
    setIsStreaming(true);

    try {
      // Auto-capture for vision presets if no snips were manually attached
      if (snipsToSend.length === 0 && (msg === "Help me with what's on my screen" || msg === "What should I say right now?")) {
        try {
          const base64Img = await invoke<string>("capture_screen");
          snipsToSend.push(base64Img);
        } catch (captureErr) {
          console.error("Capture failed:", captureErr);
          alert("Screen capture failed! Please make sure crackit has Screen Recording permissions in macOS System Settings > Privacy & Security.");
        }
      }

      let contentArray: any[] = [];
      contentArray.push({ type: "text", text: msg });
      for (const snip of snipsToSend) {
        contentArray.push({ type: "image_url", image_url: { url: snip } });
      }

      const messagesPayload = snipsToSend.length > 0 ? [
        {
          role: "user",
          content: contentArray
        }
      ] : [
        {
          role: "user",
          content: msg
        }
      ];

      await invoke("stream_ai_response", {
        apiKey: localStorage.getItem("openRouterKey") || "",
        model: localStorage.getItem(
          aiMode === "quick" ? "modelQuick" :
            aiMode === "smart" ? "modelSmart" :
              "modelUltra"
        ) || (
            aiMode === "quick" ? "google/gemini-2.0-flash" :
              aiMode === "smart" ? "anthropic/claude-3.5-sonnet" :
                "deepseek/deepseek-reasoner"
          ),
        messages: messagesPayload
      });
    } catch (e) {
      console.error(e);
      alert("AI Request Failed: " + e);
      setIsThinking(false);
      setIsStreaming(false);
    }
  };

  return (
    <div id="app">
      {/* Dedicated drag handle / top bar */}
      <div id="toolbar" className="drag-handle" onMouseDown={(e) => {
        if (e.buttons === 1 && !(e.target as HTMLElement).closest('button')) {
          getCurrentWindow().startDragging();
        }
      }}>
        <div className="drag-pill" title="Drag to move window">
          <span className="drag-dots" aria-hidden="true"></span>
          <span className="drag-label">Drag</span>
        </div>
        <button className="tb-logo" id="logo-btn" title="Settings" onClick={async () => {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("show_panel", { label: "settings" }).catch(() => {
            alert("Could not open Settings window. Please restart the app for the multi-window update to take effect!");
          });
        }}>
          <LogoIcon size={16} />
        </button>
        <div className="tb-divider"></div>
        <button className={`tb-hide ${isCollapsed ? "collapsed" : ""}`} id="hide-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
          <span className="chev"><ChevronDown size={14} /></span>
          <span>{isCollapsed ? "Show" : "Hide"}</span>
        </button>
        <div className="tb-divider"></div>
        <button className="tb-stop" id="stop-btn" title="Start / stop listening">
          <Square size={14} />
        </button>
        <div className="tb-divider"></div>
        <button className="tb-quit" id="quit-btn" title="Quit" onClick={() => invoke("quit_app")}>
          <X size={14} />
        </button>
      </div>

      {/* Main assistant panel */}
      <div id="panel-wrap">
        <span id="live-dot" className="off"></span>
        <div id="panel" className={`glass no-drag ${isCollapsed ? "collapsed" : ""}`}>
          <div id="panel-columns">
            <div id="panel-main">

              <div id="messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--tx-mut)" }}>
                    <h3 style={{ color: "var(--tx-1)", fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Hi There!</h3>
                    <p style={{ fontSize: "13px", lineHeight: 1.5 }}>How can I help you today? Try taking a snip of your screen or asking a question.</p>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div key={idx} className={msg.role === "user" ? "user-bubble" : "ai-text small"}>
                    {msg.role === "user" ? (
                      <div>{msg.content}</div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                ))}
                {isThinking && (
                  <div className="ai-text small text-gray-400 italic flex items-center gap-2 px-3 py-2">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                )}
              </div>

              <div id="action-row" style={{ opacity: isStreaming ? 0.5 : 1, pointerEvents: isStreaming ? 'none' : 'auto' }}>
                <button className="act act-primary" data-mode="say" disabled={isStreaming} onClick={() => sendPreset("What should I say right now?")}>
                  <span className="ic"><MessageCircle size={14} /></span><span>What should I say?</span>
                </button>
                <span className="sep">•</span>
                <button className="act act-secondary" data-mode="assist" disabled={isStreaming} onClick={() => sendPreset("Help me with what's on my screen")}>
                  <span className="ic"><Wand size={14} /></span><span>Assist</span>
                </button>
                <span className="sep">•</span>
                <button className="act" data-mode="followup" disabled={isStreaming} onClick={() => sendPreset("Can you expand on that?")}>
                  <span className="ic"><RefreshCw size={14} /></span><span>Follow-up</span>
                </button>
                <span className="sep">•</span>
                <button className="act" data-mode="recap" disabled={isStreaming} onClick={() => sendPreset("Summarize the conversation so far")}>
                  <span className="ic"><MessageSquareText size={14} /></span><span>Recap</span>
                </button>
              </div>

              <div id="composer" style={{ opacity: isStreaming ? 0.6 : 1 }}>
                <div id="input-area">
                  {input === "" && <div id="placeholder">Ask about your screen or conversation...</div>}
                  <textarea
                    ref={textareaRef}
                    id="input"
                    rows={1}
                    spellCheck="false"
                    value={input}
                    disabled={isStreaming}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                </div>
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
                      <span className="ic" style={{ marginLeft: "2px" }}><ChevronDown size={14} /></span>
                    </button>

                    {showModeDropdown && (
                      <>
                        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setShowModeDropdown(false)} />
                        <div className="mode-menu">
                          {aiMode !== "quick" && (
                            <button className="mode-menu-item" onClick={() => { setAiMode("quick"); setShowModeDropdown(false); }}>
                              <Zap size={14} /> Quick
                            </button>
                          )}
                          {aiMode !== "smart" && (
                            <button className="mode-menu-item" onClick={() => { setAiMode("smart"); setShowModeDropdown(false); }}>
                              <Sparkles size={14} /> Smart
                            </button>
                          )}
                          {aiMode !== "ultra" && (
                            <button className="mode-menu-item" onClick={() => { setAiMode("ultra"); setShowModeDropdown(false); }}>
                              <Flame size={14} /> Ultra
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <button id="snip-interactive-btn" className="smart-pill" title="Snip Region" onClick={() => handleSnip(true)} disabled={isCapturing || isStreaming} style={{ marginLeft: '8px', color: pendingSnips.length > 0 ? 'var(--accent, #3b82f6)' : undefined, borderColor: pendingSnips.length > 0 ? 'rgba(59, 130, 246, 0.3)' : undefined }}>
                    <span className="ic"><Scissors size={14} /></span>
                    <span>{pendingSnips.length > 0 ? `${pendingSnips.length} Snip${pendingSnips.length > 1 ? 's' : ''}` : 'Snip'}</span>
                  </button>
                  <button id="snip-full-btn" className="smart-pill" title="Capture Entire Screen" onClick={() => handleSnip(false)} disabled={isCapturing || isStreaming} style={{ marginLeft: '4px' }}>
                    <span className="ic"><Monitor size={14} /></span>
                  </button>
                  <button id="history-btn" className="history-btn" title="View conversation history" disabled={isStreaming} onClick={async () => {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("show_panel", { label: "history" }).catch(() => {
                      alert("Could not open History window. Please restart the app for the multi-window update to take effect!");
                    });
                  }}>
                    <span className="ic"><History size={16} /></span>
                  </button>
                  <button id="new-chat-btn" className="history-btn" title="New Chat" disabled={isStreaming} onClick={() => {
                    setSessionId(Date.now().toString());
                    setMessages([]);
                  }} style={{ marginLeft: '4px' }}>
                    <span className="ic"><Plus size={16} /></span>
                  </button>
                  <button id="more-btn" className="more-btn" title="Settings" disabled={isStreaming} onClick={async () => {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("show_panel", { label: "settings" }).catch(() => {
                      alert("Could not open Settings window. Please restart the app!");
                    });
                  }}>
                    <span className="ic"><Settings size={16} /></span>
                  </button>
                  <div className="spacer"></div>
                  <button id="send-btn" title="Send" onClick={handleSend} disabled={isStreaming}>
                    <ArrowUp size={16} />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

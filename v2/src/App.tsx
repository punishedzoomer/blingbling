import { Toolbar } from "./components/Toolbar";
import { MessageList } from "./components/MessageList";
import { ComposerBottom } from "./components/ComposerBottom";
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import "katex/dist/katex.min.css";
import { useDynamicBounds } from "./useDynamicBounds";
import { X, Plus } from "lucide-react";
import "./App.css";
import { ActionButtons } from "./components/ActionButtons";
import { InputArea } from "./components/InputArea";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  contextText?: string;
  contextImages?: string[];
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tags, setTags] = useState<any[]>(() => {
    const saved = localStorage.getItem("customTags");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const getSystemPrompt = () => {
    return "You are a helpful, elite AI assistant. Always provide clean, optimal, and flawless answers.";
  };



  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "customWorkflows" && e.newValue) {
        setTags(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [input, setInput] = useState("");




  const [pendingSnips, setPendingSnips] = useState<string[]>([]);
  const [pendingContextText, setPendingContextText] = useState("");
  const [showSnipsTray, setShowSnipsTray] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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
  const [showContextState, setShowContextState] = useState<{[key: number]: boolean}>({});
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync messages to History window and save to backend whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      invoke("save_session", { sessionId, data: { history: messages, tagId: activeTagId, title: sessionTitle } }).catch(console.error);
    }
    emit("history-sync", messages);
  }, [messages, sessionId, sessionTitle]);

  // Auto-generate session title after first response
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

  // Listen for actions from other windows
  useEffect(() => {
    let unlistenClear: any, unlistenSimulate: any, unlistenAddMsg: any, unlistenRestore: any, unlistenReset: any;
    listen("clear-history", () => { setMessages([]); setActiveTagId(null); setSessionTitle(null); }).then(f => unlistenClear = f);
    listen("reset-session", () => { setSessionId(Date.now().toString()); setMessages([]); setActiveTagId(null); setSessionTitle(null); }).then(f => unlistenReset = f);
      listen("add-message", (e: any) => setMessages(prev => [...prev, e.payload])).then(f => unlistenAddMsg = f);
      listen("restore-session", (e: any) => {
        const { id, data, tagId, title } = e.payload;
        setSessionId(id);
        setMessages(data);
        setActiveTagId(tagId || null);
        setSessionTitle(title || null);
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

    return () => {
      if (unlistenClear) unlistenClear();
      if (unlistenAddMsg) unlistenAddMsg();
      if (unlistenSimulate) unlistenSimulate();
      if (unlistenRestore) unlistenRestore();
      if (unlistenReset) unlistenReset();
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

    const unlistenSnip = listen<string>("extension-snip-received", (event) => {
      try {
        const payload = JSON.parse(event.payload);
        if (payload.image) {
          setPendingSnips((prev) => [...prev, payload.image]);
        }
        if (payload.extraImages && payload.extraImages.length > 0) {
          setPendingSnips((prev) => [...prev, ...payload.extraImages]);
        }
        if (payload.text) {
          setPendingContextText(payload.text);
        }
      } catch (e) {
        // Fallback for legacy format
        setPendingSnips((prev) => [...prev, event.payload]);
      }
      invoke("show_panel", { label: "main" });
    });

    return () => { 
      unlisten.then((f) => f()); 
      unlistenSnip.then((f) => f());
    };
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
        base64Img = await invoke<string>("capture_screen_interactive");
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
    setMessages((prev) => [...prev, { 
      role: "user", 
      content: userMsg || "(Sent snip)",
      contextText: pendingContextText || undefined,
      contextImages: pendingSnips.length > 0 ? [...pendingSnips] : undefined
    }]);
    setInput("");

    const snipsToSend = [...pendingSnips];
    const contextToSend = pendingContextText;
    setPendingSnips([]);
    setPendingContextText("");
    setShowSnipsTray(false);
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

      const previousMessages = messages.map(m => {
        let textContent = m.content;
        if (m.contextText) {
            textContent += `\n\n<context>\n${m.contextText}\n</context>`;
        }
        return { role: m.role, content: m.contextImages ? [
            { type: "text", text: textContent },
            ...m.contextImages.map((img: string) => ({ type: "image_url", image_url: { url: img } }))
        ] : textContent };
      });
      
      if (contextToSend) {
        contentArray.push({ type: "text", text: `\n\n<context>\n${contextToSend}\n</context>` });
      }
      
      const currentMessage = contentArray.length > 0 && typeof contentArray[0] === 'object' ? {
        role: "user",
        content: contentArray
      } : {
        role: "user",
        content: userMsg
      };

      const messagesPayload = [
        { role: "system", content: getSystemPrompt() },
        ...previousMessages, 
        currentMessage
      ];

      await invoke("stream_ai_response", {
        apiKey: localStorage.getItem("openRouterKey") || "",
        model: localStorage.getItem(
          aiMode === "quick" ? "modelQuick" :
            aiMode === "smart" ? "modelSmart" :
              "modelUltra"
        ) || (
            aiMode === "quick" ? "openai/gpt-4o-mini" :
              aiMode === "smart" ? "anthropic/claude-3.5-sonnet" :
                "deepseek/deepseek-reasoner"
          ),
        messages: messagesPayload
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
    const previousMessages = messages;
    setMessages((prev) => [...prev, { 
      role: "user", 
      content: msg,
      contextText: pendingContextText || undefined,
      contextImages: pendingSnips.length > 0 ? [...pendingSnips] : undefined
    }]);

    let snipsToSend = [...pendingSnips];
    const contextToSend = pendingContextText;
    setPendingSnips([]);
    setPendingContextText("");
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

      const currentMessage = snipsToSend.length > 0 || contextToSend ? {
        role: "user",
        content: contentArray
      } : {
        role: "user",
        content: msg
      };

      const messagesPayload = [
        { role: "system", content: getSystemPrompt() },
        ...previousMessages, 
        currentMessage
      ];

      await invoke("stream_ai_response", {
        apiKey: localStorage.getItem("openRouterKey") || "",
        model: localStorage.getItem(
          aiMode === "quick" ? "modelQuick" :
            aiMode === "smart" ? "modelSmart" :
              "modelUltra"
        ) || (
            aiMode === "quick" ? "openai/gpt-4o-mini" :
              aiMode === "smart" ? "anthropic/claude-3.5-sonnet" :
                "deepseek/deepseek-reasoner"
          ),
        messages: messagesPayload
      });
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "**Error:** " + e }]);
      setIsThinking(false);
      setIsStreaming(false);
    }
  };

  return (
    <div id="app">
      {/* Dedicated drag handle / top bar */}
      <Toolbar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      {/* Main assistant panel */}
      <div id="panel-wrap">
        <span id="live-dot" className="off"></span>
        <div id="panel" className={`glass no-drag ${isCollapsed ? "collapsed" : ""}`}>
          <div id="panel-columns">
            <div id="panel-main">

              <MessageList 
                messages={messages} 
                showContextState={showContextState} 
                setShowContextState={setShowContextState} 
                setInput={setInput} 
                setPendingContextText={setPendingContextText} 
                setPendingSnips={setPendingSnips} 
                setPreviewImage={setPreviewImage} 
                isThinking={isThinking} 
              />
              <ActionButtons isStreaming={isStreaming} sendPreset={sendPreset} />

              <div id="composer" style={{ opacity: isStreaming ? 0.6 : 1 }}>
                                {showSnipsTray && pendingSnips.length > 0 && (
                  <div className="snips-tray" style={{ display: 'flex', gap: '8px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
                    {pendingSnips.map((snip, idx) => (
                      <div key={idx} style={{ position: 'relative', flexShrink: 0, cursor: 'zoom-in' }} onClick={() => setPreviewImage(snip)}>
                        <img src={snip} style={{ height: '60px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} alt="Snip preview" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newSnips = pendingSnips.filter((_, i) => i !== idx);
                            setPendingSnips(newSnips);
                            if (newSnips.length === 0) setShowSnipsTray(false);
                          }}
                          style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => handleSnip(true)}
                      style={{ height: '60px', minWidth: '40px', padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', color: 'var(--tx-mut)', gap: '4px' }}
                    >
                      <Plus size={16} />
                      <span style={{ fontSize: '10px' }}>Add</span>
                    </button>
                  </div>
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
            isLocked={messages.length > 0}
          />
                <ComposerBottom 
                  aiMode={aiMode} 
                  setAiMode={setAiMode} 
                  showModeDropdown={showModeDropdown} 
                  setShowModeDropdown={setShowModeDropdown} 
                  pendingSnips={pendingSnips} 
                  showSnipsTray={showSnipsTray} 
                  setShowSnipsTray={setShowSnipsTray} 
                  handleSnip={handleSnip} 
                  isCapturing={isCapturing} 
                  isStreaming={isStreaming} 
                  setSessionId={setSessionId} 
                  setMessages={setMessages} 
                  setInput={setInput} 
                  setPendingSnips={setPendingSnips} 
                  setPendingContextText={setPendingContextText} 
                  setActiveTagId={setActiveTagId} 
                  setSessionTitle={setSessionTitle} 
                  handleSend={handleSend} 
                  input={input} 
                />
              </div>

            </div>
          </div>
        </div>
      </div>
      
      {/* Fullscreen Image Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, 
            background: 'rgba(30, 30, 30, 0.4)', backdropFilter: 'blur(20px)',
            borderRadius: '24px', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px', cursor: 'zoom-out',
            pointerEvents: 'auto'
          }}
        >
          <button 
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', cursor: 'pointer', zIndex: 10000,
              pointerEvents: 'auto', backdropFilter: 'blur(10px)'
            }}
            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
            title="Close Preview (Esc)"
          >
            <X size={20} />
          </button>
          <img 
            src={previewImage} 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', 
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)', 
              border: '1px solid rgba(255,255,255,0.1)', cursor: 'default'
            }} 
          />
        </div>
      )}
    </div>
  );
}

export default App;

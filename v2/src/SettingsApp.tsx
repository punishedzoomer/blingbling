import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings, Zap, Sparkles, Flame, ChevronDown, Search } from "lucide-react";
import "./App.css";
import { useDynamicBounds } from "./useDynamicBounds";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
}

function ModelSelect({ value, onChange, models, disabled }: { value: string, onChange: (v: string) => void, models: OpenRouterModel[], disabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedModel = models.find(m => m.id === value);
  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: "var(--r-8)", 
          border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", 
          color: "var(--tx-1)", display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, textAlign: "left"
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedModel ? selectedModel.name : (value || "Select a model...")}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px",
          background: "rgba(30,30,30,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "var(--r-8)", backdropFilter: "blur(12px)", zIndex: 1000,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column",
          maxHeight: "260px", overflow: "hidden"
        }}>
          <div style={{ padding: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Search size={14} style={{ color: "var(--tx-mut)" }} />
            <input 
              autoFocus
              type="text" 
              placeholder="Search models..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", background: "transparent", border: "none", color: "var(--tx-1)", outline: "none", fontSize: "13px" }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "4px" }}>
            {filteredModels.length === 0 ? (
              <div style={{ padding: "8px 12px", color: "var(--tx-mut)", fontSize: "12px", textAlign: "center" }}>No models found</div>
            ) : (
              filteredModels.map(m => {
                const price = (parseFloat(m.pricing?.prompt || "0") * 1000000).toFixed(2);
                return (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.id); setIsOpen(false); setSearch(""); }}
                    style={{
                      width: "100%", padding: "6px 8px", textAlign: "left", background: "transparent",
                      border: "none", borderRadius: "var(--r-4)", cursor: "pointer",
                      display: "flex", flexDirection: "column", gap: "2px"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ color: "var(--tx-1)", fontSize: "13px" }}>{m.name}</div>
                    <div style={{ color: "var(--tx-mut)", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                      <span>{m.id.split('/')[0]}</span>
                      <span>${price}/1M tokens</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsApp() {
  useDynamicBounds("settings");

  const [openRouterKey, setOpenRouterKey] = useState("");
  const [keyUsage, setKeyUsage] = useState<number | null>(null);
  const [keyLimit, setKeyLimit] = useState<number | null>(null);
  const [isFetchingUsage, setIsFetchingUsage] = useState(false);
  const [modelQuick, setModelQuick] = useState("");
  const [modelSmart, setModelSmart] = useState("");
  const [modelUltra, setModelUltra] = useState("");
  const [allowSystemScreenshots, setAllowSystemScreenshots] = useState(false);

  const [allModels, setAllModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    setOpenRouterKey(localStorage.getItem("openRouterKey") || "");
    setModelQuick(localStorage.getItem("modelQuick") || "google/gemini-2.0-flash");
    setModelSmart(localStorage.getItem("modelSmart") || "anthropic/claude-3.5-sonnet");
    setModelUltra(localStorage.getItem("modelUltra") || "deepseek/deepseek-reasoner");
    setAllowSystemScreenshots(localStorage.getItem("allowSystemScreenshots") === "true");

    fetch("https://openrouter.ai/api/v1/models")
      .then(res => res.json())
      .then(data => {
        const allModels: OpenRouterModel[] = data.data;
        
        const majorProviders = ['openai/', 'anthropic/', 'google/', 'meta-llama/', 'deepseek/', 'x-ai/', 'mistralai/', 'cohere/', 'moonshotai/'];

        const filtered = allModels.filter(model => {
          if (!model.pricing || !model.pricing.prompt) return false;
          if (model.id.includes("gemini-2.0")) return false;
          if (model.id.endsWith(":free")) return false;
          if (model.id.endsWith(":batch")) return false;
          return true;
        }).sort((a, b) => {
          const aMajor = majorProviders.some(p => a.id.startsWith(p));
          const bMajor = majorProviders.some(p => b.id.startsWith(p));
          if (aMajor && !bMajor) return -1;
          if (!aMajor && bMajor) return 1;
          return a.name.localeCompare(b.name);
        });

        setAllModels(filtered);
        setModelsLoaded(true);
      })
      .catch(err => {
        console.error("Failed to fetch models", err);
        setModelsLoaded(true);
      });
  }, []);

  useEffect(() => {
    localStorage.setItem("openRouterKey", openRouterKey);
    localStorage.setItem("modelQuick", modelQuick);
    localStorage.setItem("modelSmart", modelSmart);
    localStorage.setItem("modelUltra", modelUltra);
    localStorage.setItem("allowSystemScreenshots", allowSystemScreenshots.toString());
    
    // Tell the backend to toggle screenshot visibility
      invoke("set_debug_mode", { debug: allowSystemScreenshots }).catch(console.error);
  }, [openRouterKey, modelQuick, modelSmart, modelUltra, allowSystemScreenshots]);

  useEffect(() => {
    if (!openRouterKey || !openRouterKey.startsWith("sk-or-v1-")) {
      setKeyUsage(null);
      setKeyLimit(null);
      return;
    }

    setIsFetchingUsage(true);
    fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { "Authorization": `Bearer ${openRouterKey}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setKeyUsage(data.data.usage);
          setKeyLimit(data.data.limit);
        }
      })
      .catch(console.error)
      .finally(() => setIsFetchingUsage(false));
  }, [openRouterKey]);

  const simulateLLMResponse = async () => {
    // We emit an event to the main window to simulate a response
        await emit("simulate-llm");
        await invoke("hide_panel", { label: "settings" });
  };

  const testCaptureScreen = async () => {
    try {
                  const base64Img = await invoke<string>("capture_screen");
      await emit("add-message", { 
        role: "assistant", 
        content: `**Screenshot Captured!**\n\n![Screenshot](${base64Img})` 
      });
      await invoke("hide_panel", { label: "settings" });
    } catch (e) {
      alert("Capture failed: " + e);
    }
  };

  return (
    <div id="settings-window" className="glass" style={{ width: "480px", height: "fit-content", display: "flex", flexDirection: "column", padding: "16px", boxSizing: "border-box" }}>
      {/* Drag handle for the whole window */}
      <div 
        data-tauri-drag-region 
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40px", cursor: "grab", zIndex: 100 }} 
        onMouseDown={(e) => {
          if (e.buttons === 1 && !(e.target as HTMLElement).closest('button, input, select')) {
            getCurrentWindow().startDragging();
          }
        }}
      />
      <div 
        id="settings" 
        style={{ border: "none", boxShadow: "none", width: "100%", height: "fit-content", paddingTop: "30px", margin: 0, padding: 0 }}
        onMouseEnter={() => { 
          invoke("focus_panel", { label: "settings" }).catch(console.error)
        }} 
      >
        <div className="s-head">
          <div className="s-title">Settings</div>
          <button id="s-close" className="s-close" onClick={async () => {
                        await invoke("hide_panel", { label: "settings" });
          }} style={{ zIndex: 101 }}>Done</button>
        </div>
        <div className="s-tabs">
            <button className="s-tab on" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Settings size={14} style={{ marginRight: "6px" }} /> General
            </button>
        </div>
        <div className="s-body s-tab-pane" style={{ overflowY: "auto", paddingBottom: "10px", gap: "12px", display: "flex", flexDirection: "column", flex: 1, zIndex: 101 }}>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="s-label" style={{ fontSize: "12px", color: "var(--tx-mut)" }}>OpenRouter API Key</label>
                {openRouterKey && openRouterKey.startsWith("sk-or-v1-") && (
                  <span style={{ fontSize: "11px", color: "var(--tx-2)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "var(--r-4)" }}>
                    {isFetchingUsage ? "..." : `Used: $${(keyUsage || 0).toFixed(2)}${keyLimit ? ` / $${keyLimit.toFixed(2)}` : ""}`}
                  </span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input 
                  type="password" 
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder="sk-or-v1-..." 
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--r-8)", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "var(--tx-1)" }}
                />
                {keyLimit && keyLimit > 0 && !isFetchingUsage && (
                  <div style={{ position: "absolute", bottom: "1px", left: "1px", right: "1px", height: "2px", background: "rgba(255,255,255,0.05)", borderBottomLeftRadius: "var(--r-8)", borderBottomRightRadius: "var(--r-8)", overflow: "hidden" }}>
                    <div style={{ 
                      width: `${Math.min(100, Math.max(0, ((keyUsage || 0) / keyLimit) * 100))}%`, 
                      height: "100%", 
                      background: "var(--accent)", 
                      transition: "width 0.3s ease" 
                    }} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label className="s-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--tx-mut)" }}><Zap size={14} /> Quick Model</label>
              <ModelSelect
                value={modelQuick}
                onChange={setModelQuick}
                models={allModels}
                disabled={!modelsLoaded}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label className="s-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--tx-mut)" }}><Sparkles size={14} /> Smart Model</label>
              <ModelSelect
                value={modelSmart}
                onChange={setModelSmart}
                models={allModels}
                disabled={!modelsLoaded}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label className="s-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--tx-mut)" }}><Flame size={14} /> Ultra Model</label>
              <ModelSelect
                value={modelUltra}
                onChange={setModelUltra}
                models={allModels}
                disabled={!modelsLoaded}
              />
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.05)", margin: "8px 0" }}/>

            {import.meta.env.DEV && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label className="s-label" style={{ fontSize: "12px", color: "var(--tx-mut)" }}>Debugging</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "var(--r-8)" }}>
                  <input 
                    type="checkbox" 
                    checked={allowSystemScreenshots}
                    onChange={(e) => setAllowSystemScreenshots(e.target.checked)}
                  />
                  <span style={{ fontSize: "13px", color: "var(--tx-2)" }}>Allow System Screenshots (Debug)</span>
                </div>

                <button 
                  onClick={simulateLLMResponse}
                  style={{ padding: "8px", background: "var(--accent)", color: "#fff", borderRadius: "var(--r-8)", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
                >
                  Test Markdown Parsing
                </button>
                <button 
                  onClick={testCaptureScreen}
                  style={{ padding: "8px", background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: "var(--r-8)", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "13px", fontWeight: 500, margin: "4px 0 20px" }}
                >
                  Test Capture Screen
                </button>
              </div>
            )}

        </div>
      </div>
    </div>
  );
}

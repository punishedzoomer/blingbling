import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings, Zap, Sparkles, Flame } from "lucide-react";
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

export function SettingsApp() {
  useDynamicBounds("settings");

  const [openRouterKey, setOpenRouterKey] = useState("");
  const [modelQuick, setModelQuick] = useState("");
  const [modelSmart, setModelSmart] = useState("");
  const [modelUltra, setModelUltra] = useState("");
  const [allowSystemScreenshots, setAllowSystemScreenshots] = useState(false);

  const [quickModels, setQuickModels] = useState<OpenRouterModel[]>([]);
  const [smartModels, setSmartModels] = useState<OpenRouterModel[]>([]);
  const [ultraModels, setUltraModels] = useState<OpenRouterModel[]>([]);
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
        
        const quick: OpenRouterModel[] = [];
        const smart: OpenRouterModel[] = [];
        const ultra: OpenRouterModel[] = [];

        // Sort models by name initially
        allModels.sort((a, b) => a.name.localeCompare(b.name));

        const majorProviders = ['openai/', 'anthropic/', 'google/', 'meta-llama/', 'deepseek/', 'x-ai/', 'mistralai/', 'cohere/', 'moonshotai/'];

        allModels.forEach(model => {
          if (!model.pricing || !model.pricing.prompt) return;
          // Exclude gemini-2.0 as requested
          if (model.id.includes("gemini-2.0")) return;
          // Filter out :free models to reduce clutter
          if (model.id.endsWith(":free")) return;
          // Filter out batch models to reduce clutter
          if (model.id.endsWith(":batch")) return;
          
          const promptPrice = parseFloat(model.pricing.prompt);
          const pricePer1M = promptPrice * 1000000;
          
          const isUltraKeyword = /reasoner|o1|o3|opus/i.test(model.id);
          
          if (isUltraKeyword || pricePer1M > 4.0) {
            ultra.push(model);
          } else if (pricePer1M >= 1.0) {
            smart.push(model);
          } else {
            quick.push(model);
          }
        });

        // Function to sort prioritizing coding capability and major providers
        const limitAndSort = (models: any[]) => {
          return models
            .sort((a, b) => {
              const aCode = a.benchmarks?.artificial_analysis?.coding_index || 0;
              const bCode = b.benchmarks?.artificial_analysis?.coding_index || 0;
              
              if (aCode !== bCode) {
                return bCode - aCode; // Highest coding index first
              }

              const aMajor = majorProviders.some(p => a.id.startsWith(p));
              const bMajor = majorProviders.some(p => b.id.startsWith(p));
              if (aMajor && !bMajor) return -1;
              if (!aMajor && bMajor) return 1;
              
              return 0; // maintain alphabetical order
            })
            .slice(0, 30); // Limit to top 30 per category
        };

        setQuickModels(limitAndSort(quick));
        setSmartModels(limitAndSort(smart));
        setUltraModels(limitAndSort(ultra));
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
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("set_debug_mode", { debug: allowSystemScreenshots }).catch(console.error);
    });
  }, [openRouterKey, modelQuick, modelSmart, modelUltra, allowSystemScreenshots]);

  const simulateLLMResponse = async () => {
    // We emit an event to the main window to simulate a response
    const { emit } = await import("@tauri-apps/api/event");
    await emit("simulate-llm");
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("hide_panel", { label: "settings" });
  };

  const testCaptureScreen = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { emit } = await import("@tauri-apps/api/event");
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
    <div id="settings-window" className="glass" style={{ width: "fit-content", height: "fit-content", display: "flex", flexDirection: "column", padding: "16px", boxSizing: "border-box" }}>
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
        style={{ border: "none", boxShadow: "none", width: "fit-content", height: "fit-content", paddingTop: "30px", margin: 0, padding: 0 }}
        onMouseEnter={() => { 
          import("@tauri-apps/api/core").then(({ invoke }) => invoke("focus_panel", { label: "settings" }).catch(console.error)) 
        }} 
        onMouseLeave={() => { 
          import("@tauri-apps/api/core").then(({ invoke }) => invoke("unfocus_panel").catch(console.error)) 
        }}
      >
        <div className="s-head">
          <div className="s-title">Settings</div>
          <button id="s-close" className="s-close" onClick={async () => {
            const { invoke } = await import("@tauri-apps/api/core");
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
              <label className="s-label" style={{ fontSize: "12px", color: "var(--tx-mut)" }}>OpenRouter API Key</label>
              <input 
                type="password" 
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-v1-..." 
                style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--r-8)", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "var(--tx-1)" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label className="s-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--tx-mut)" }}><Zap size={14} /> Quick Model</label>
              <select 
                value={modelQuick}
                onChange={(e) => setModelQuick(e.target.value)}
                disabled={!modelsLoaded}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--r-8)", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "var(--tx-1)" }}
              >
                {!modelsLoaded ? <option>Loading models...</option> : quickModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                {/* Fallback if list is empty or doesn't have the selected model */}
                {modelsLoaded && !quickModels.some(m => m.id === modelQuick) && modelQuick && (
                  <option value={modelQuick}>{modelQuick} (Current)</option>
                )}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label className="s-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--tx-mut)" }}><Sparkles size={14} /> Smart Model</label>
              <select 
                value={modelSmart}
                onChange={(e) => setModelSmart(e.target.value)}
                disabled={!modelsLoaded}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--r-8)", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "var(--tx-1)" }}
              >
                {!modelsLoaded ? <option>Loading models...</option> : smartModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                {modelsLoaded && !smartModels.some(m => m.id === modelSmart) && modelSmart && (
                  <option value={modelSmart}>{modelSmart} (Current)</option>
                )}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label className="s-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--tx-mut)" }}><Flame size={14} /> Ultra Model</label>
              <select 
                value={modelUltra}
                onChange={(e) => setModelUltra(e.target.value)}
                disabled={!modelsLoaded}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--r-8)", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "var(--tx-1)" }}
              >
                {!modelsLoaded ? <option>Loading models...</option> : ultraModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                {modelsLoaded && !ultraModels.some(m => m.id === modelUltra) && modelUltra && (
                  <option value={modelUltra}>{modelUltra} (Current)</option>
                )}
              </select>
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

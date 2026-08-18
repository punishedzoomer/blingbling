import re

with open("v2/src/SettingsApp.tsx", "r") as f:
    content = f.read()

# 1. Add new icons to imports
content = content.replace(
    'import { Settings, Zap, Sparkles, Flame } from "lucide-react";',
    'import { Settings, Zap, Sparkles, Flame, MessageCircle, LayoutTemplate, Terminal } from "lucide-react";'
)

# 2. Add tab state and buttons state to SettingsApp
state_injection = """
  const [activeTab, setActiveTab] = useState("general");
  const [buttons, setButtons] = useState(() => {
    const saved = localStorage.getItem("buttonConfigs");
    return saved ? JSON.parse(saved) : [
      { label: "Solve", prompt: "Solve this problem" },
      { label: "Explain", prompt: "Explain this problem" },
      { label: "Optimize", prompt: "Optimize this code" },
      { label: "Debug", prompt: "Find bugs in this code" }
    ];
  });

  const saveButtons = (newButtons: any) => {
    setButtons(newButtons);
    localStorage.setItem("buttonConfigs", JSON.stringify(newButtons));
  };
"""
content = content.replace("export function SettingsApp() {", "export function SettingsApp() {\n" + state_injection)

# 3. Replace the return statement with the new tabbed layout
old_return_start = "  return (\n    <div id=\"settings-window\""
new_return = """  return (
    <div id="settings-window" className="glass" style={{ width: "480px", height: "fit-content", minHeight: "400px", display: "flex", flexDirection: "column", padding: "16px", boxSizing: "border-box" }}>
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

        <div className="s-tabs" style={{ zIndex: 101, position: "relative" }}>
            <button className={`s-tab ${activeTab === 'general' ? 'on' : ''}`} onClick={() => setActiveTab('general')} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Settings size={14} style={{ marginRight: "6px" }} /> General
            </button>
            <button className={`s-tab ${activeTab === 'prompts' ? 'on' : ''}`} onClick={() => setActiveTab('prompts')} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={14} style={{ marginRight: "6px" }} /> Prompts
            </button>
            <button className={`s-tab ${activeTab === 'advanced' ? 'on' : ''}`} onClick={() => setActiveTab('advanced')} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <LayoutTemplate size={14} style={{ marginRight: "6px" }} /> Advanced
            </button>
            {import.meta.env.DEV && (
              <button className={`s-tab ${activeTab === 'dev' ? 'on' : ''}`} onClick={() => setActiveTab('dev')} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Terminal size={14} style={{ marginRight: "6px" }} /> Dev
              </button>
            )}
        </div>

        <div className="s-body s-tab-pane" style={{ overflowY: "auto", paddingBottom: "10px", gap: "12px", display: "flex", flexDirection: "column", flex: 1, zIndex: 101 }}>
            
            {activeTab === 'general' && (
              <>
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
              </>
            )}

            {activeTab === 'prompts' && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ fontSize: "12px", color: "var(--tx-2)", lineHeight: "1.5" }}>
                  Customize the behavior of the 4 quick action buttons below the chat.
                </div>
                {buttons.map((btn: any, i: number) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px" }}>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <label className="s-label" style={{ fontSize: "11px", color: "var(--tx-mut)" }}>Button Label</label>
                        <input 
                          type="text" 
                          value={btn.label}
                          onChange={(e) => {
                            const newBtns = [...buttons];
                            newBtns[i].label = e.target.value;
                            saveButtons(newBtns);
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "var(--tx-1)", fontSize: "12px" }}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label className="s-label" style={{ fontSize: "11px", color: "var(--tx-mut)" }}>System Prompt</label>
                        <input 
                          type="text" 
                          value={btn.prompt}
                          onChange={(e) => {
                            const newBtns = [...buttons];
                            newBtns[i].prompt = e.target.value;
                            saveButtons(newBtns);
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "var(--tx-1)", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'advanced' && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "150px", color: "var(--tx-mut)", fontSize: "13px" }}>
                Advanced settings coming soon...
              </div>
            )}

            {activeTab === 'dev' && import.meta.env.DEV && (
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
"""

index = content.find(old_return_start)
if index != -1:
    content = content[:index] + new_return
    with open("v2/src/SettingsApp.tsx", "w") as f:
        f.write(content)
    print("Updated SettingsApp.tsx")
else:
    print("Could not find the return statement in SettingsApp.tsx")

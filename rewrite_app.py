import re

with open("v2/src/App.tsx", "r") as f:
    content = f.read()

# 1. Add state to App component
state_hook = """  const [input, setInput] = useState("");
  const [buttons, setButtons] = useState(() => {
    const saved = localStorage.getItem("buttonConfigs");
    return saved ? JSON.parse(saved) : [
      { label: "Solve", prompt: "Solve this problem" },
      { label: "Explain", prompt: "Explain this problem" },
      { label: "Optimize", prompt: "Optimize this code" },
      { label: "Debug", prompt: "Find bugs in this code" }
    ];
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "buttonConfigs" && e.newValue) {
        setButtons(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);"""
content = content.replace('  const [input, setInput] = useState("");', state_hook)

# 2. Replace action-row
old_action_row = """              <div id="action-row" style={{ opacity: isStreaming ? 0.5 : 1, pointerEvents: isStreaming ? 'none' : 'auto' }}>
                <button className="act act-primary" data-mode="say" disabled={isStreaming} onClick={() => sendPreset("Solve this problem")}>
                  <span className="ic"><Wand size={14} /></span><span>Solve</span>
                </button>
                <span className="sep">•</span>
                <button className="act act-secondary" data-mode="assist" disabled={isStreaming} onClick={() => sendPreset("Explain this problem")}>
                  <span className="ic"><MessageCircle size={14} /></span><span>Explain</span>
                </button>
                <span className="sep">•</span>
                <button className="act" data-mode="followup" disabled={isStreaming} onClick={() => sendPreset("Optimize this code")}>
                  <span className="ic"><Zap size={14} /></span><span>Optimize</span>
                </button>
                <span className="sep">•</span>
                <button className="act" data-mode="recap" disabled={isStreaming} onClick={() => sendPreset("Find bugs in this code")}>
                  <span className="ic"><Monitor size={14} /></span><span>Debug</span>
                </button>
              </div>"""

new_action_row = """              <div id="action-row" style={{ opacity: isStreaming ? 0.5 : 1, pointerEvents: isStreaming ? 'none' : 'auto' }}>
                {buttons.map((btn: any, i: number) => (
                  <React.Fragment key={i}>
                    <button className={`act ${i === 0 ? 'act-primary' : i === 1 ? 'act-secondary' : ''}`} disabled={isStreaming} onClick={() => sendPreset(btn.prompt)}>
                      <span className="ic">
                        {i === 0 ? <Wand size={14} /> : i === 1 ? <MessageCircle size={14} /> : i === 2 ? <Zap size={14} /> : <Monitor size={14} />}
                      </span>
                      <span>{btn.label}</span>
                    </button>
                    {i < buttons.length - 1 && <span className="sep">•</span>}
                  </React.Fragment>
                ))}
              </div>"""

content = content.replace(old_action_row, new_action_row)

# Also need to make sure React is imported for React.Fragment, but we can just use import React if not present, or import { Fragment }
# I'll just change <React.Fragment> to <Fragment> and add import { Fragment }
content = content.replace('<React.Fragment', '<Fragment').replace('</React.Fragment>', '</Fragment>')
if 'import { Fragment }' not in content:
    content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef, Fragment } from "react";')

with open("v2/src/App.tsx", "w") as f:
    f.write(content)
print("Updated App.tsx")

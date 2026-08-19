import { useState, useEffect } from "react";

interface InputAreaProps {
  input: string;
  setInput: (val: string) => void;
  isStreaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleSend: () => void;
  workflows: any[];
  activeWorkflowId: string | null;
  setActiveWorkflowId: (id: string | null) => void;
  isLocked: boolean;
}

export function InputArea({ input, setInput, isStreaming, textareaRef, handleSend, workflows, activeWorkflowId, setActiveWorkflowId, isLocked }: InputAreaProps) {
  const [showWorkflowDropdown, setShowWorkflowDropdown] = useState(false);

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);
  const activeColor = activeWorkflow ? activeWorkflow.color : "#3c83f5";

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', activeColor);
  }, [activeColor]);

  return (
    <div id="input-area" style={{ display: "flex", alignItems: "flex-start", gap: "10px", position: "relative" }}>
      
      {/* Workflow Switcher Pill */}
      <div style={{ position: "relative", zIndex: 10, paddingTop: "2px" }}>
        {!showWorkflowDropdown ? (
          <button 
            onClick={() => { if (!isLocked) setShowWorkflowDropdown(true); }}
            disabled={isLocked}
            style={{ 
              display: "flex", alignItems: "center", gap: "6px", 
              padding: "4px 8px", background: "rgba(0,0,0,0.3)", 
              border: `1px solid ${activeColor}`, borderRadius: "12px", 
              color: "var(--tx-1)", fontSize: "11px", fontWeight: 500,
              cursor: isLocked ? "default" : "pointer",
              opacity: isLocked ? 0.6 : 1,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              whiteSpace: "nowrap"
            }}
            title={isLocked ? "Workflow locked for this session" : "Select Workflow"}
          >
            <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{activeWorkflow ? activeWorkflow.name : "General"}</span>
          </button>
        ) : (
          <>
            <div 
              style={{ position: "fixed", inset: 0, zIndex: 90 }} 
              onClick={() => setShowWorkflowDropdown(false)}
            />
            <div style={{ 
              position: "absolute", top: "2px", left: 0, zIndex: 100,
              display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap",
              width: "max-content", maxWidth: "60vw",
              background: "var(--bg)", padding: "4px", borderRadius: "14px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)"
            }}>
              <button
                onClick={() => { setActiveWorkflowId(null); setShowWorkflowDropdown(false); }}
                style={{
                  display: "flex", alignItems: "center", padding: "4px 8px", 
                  background: !activeWorkflowId ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.3)", 
                  border: `1px solid #3c83f5`, borderRadius: "10px", 
                  cursor: "pointer", whiteSpace: "nowrap"
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 700 }}>General</span>
              </button>
              {workflows.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => { setActiveWorkflowId(wf.id); setShowWorkflowDropdown(false); }}
                  style={{
                    display: "flex", alignItems: "center", padding: "4px 8px", 
                    background: activeWorkflowId === wf.id ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.3)", 
                    border: `1px solid ${wf.color}`, borderRadius: "10px", 
                    cursor: "pointer", whiteSpace: "nowrap"
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 700 }}>{wf.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, position: "relative" }}>
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
    </div>
  );
}

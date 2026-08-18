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
        <button 
          onClick={() => { if (!isLocked) setShowWorkflowDropdown(!showWorkflowDropdown); }}
          disabled={isLocked}
          style={{ 
            display: "flex", alignItems: "center", gap: "6px", 
            padding: "4px 8px", background: "rgba(0,0,0,0.3)", 
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", 
            color: "var(--tx-1)", fontSize: "11px", fontWeight: 500,
            cursor: isLocked ? "default" : "pointer",
            opacity: isLocked ? 0.6 : 1,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)"
          }}
          title={isLocked ? "Workflow locked for this session" : "Select Workflow"}
        >
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: activeColor, boxShadow: `0 0 8px ${activeColor}` }} />
          <span style={{ opacity: 0.9 }}># {activeWorkflow ? activeWorkflow.name : "General"}</span>
        </button>

        {showWorkflowDropdown && (
          <>
            <div 
              style={{ position: "fixed", inset: 0, zIndex: 90 }} 
              onClick={() => setShowWorkflowDropdown(false)}
            />
            <div style={{ 
              position: "absolute", bottom: "calc(100% + 12px)", left: 0, zIndex: 100,
              background: "rgba(20,20,20,0.85)", backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
              padding: "6px", display: "flex", flexDirection: "column", gap: "2px",
              minWidth: "160px", boxShadow: "0 12px 40px rgba(0,0,0,0.6)"
            }}>
              <div 
                onClick={() => { setActiveWorkflowId(null); setShowWorkflowDropdown(false); }}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", background: !activeWorkflowId ? "rgba(255,255,255,0.1)" : "transparent" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = !activeWorkflowId ? "rgba(255,255,255,0.1)" : "transparent"}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3c83f5" }} />
                <span style={{ fontSize: "13px", color: "var(--tx-1)", flex: 1 }}>General</span>
              </div>
              
              {workflows.length > 0 && <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "4px 0" }} />}
              
              {workflows.map(wf => (
                <div 
                  key={wf.id}
                  onClick={() => { setActiveWorkflowId(wf.id); setShowWorkflowDropdown(false); }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", background: activeWorkflowId === wf.id ? "rgba(255,255,255,0.1)" : "transparent" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = activeWorkflowId === wf.id ? "rgba(255,255,255,0.1)" : "transparent"}
                >
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: wf.color }} />
                  <span style={{ fontSize: "13px", color: "var(--tx-1)", flex: 1 }}>{wf.name}</span>
                </div>
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

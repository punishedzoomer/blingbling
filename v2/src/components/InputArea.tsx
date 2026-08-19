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
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);
  const activeColor = activeWorkflow ? activeWorkflow.color : "#3c83f5";

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', activeColor);
  }, [activeColor]);

  const allWorkflows = [{ id: null, name: "General", color: "#3c83f5" }, ...workflows];
  const filteredWorkflows = allWorkflows.filter(w => w.name.toLowerCase().includes(slashQuery.toLowerCase()));

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    if (isLocked) {
      setIsSlashOpen(false);
      return;
    }

    const match = val.match(/(^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (match) {
      setIsSlashOpen(true);
      setSlashQuery(match[2]);
      setSlashIndex(0);
    } else {
      setIsSlashOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashOpen && filteredWorkflows.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % filteredWorkflows.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + filteredWorkflows.length) % filteredWorkflows.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredWorkflows[slashIndex];
        setActiveWorkflowId(selected.id);
        
        const match = input.match(/(^|\s)\/([a-zA-Z0-9_-]*)$/);
        if (match) {
          const newVal = input.slice(0, match.index) + match[1];
          setInput(newVal);
        }
        setIsSlashOpen(false);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSlashOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSlashOpen) handleSend();
    }
  };

  return (
    <div id="input-area" style={{ display: "flex", alignItems: "flex-start", gap: "10px", position: "relative" }}>
      
      {/* Workflow Switcher Pill (Static Indicator) */}
      <div style={{ position: "relative", zIndex: 10, paddingTop: "2px" }}>
        <div 
          style={{ 
            display: "flex", alignItems: "center", gap: "6px", 
            padding: "4px 8px", background: "rgba(0,0,0,0.3)", 
            border: `1px solid ${activeColor}`, borderRadius: "12px", 
            opacity: isLocked ? 0.6 : 1,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
            whiteSpace: "nowrap"
          }}
          title={isLocked ? "Workflow locked for this session" : "Current Workflow (Type / to change)"}
        >
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 700 }}>{activeWorkflow ? activeWorkflow.name : "General"}</span>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {isSlashOpen && filteredWorkflows.length > 0 && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 10px)", left: 0, zIndex: 100,
            background: "rgba(20,20,20,0.95)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
            padding: "6px", display: "flex", flexDirection: "column", gap: "2px",
            minWidth: "180px", boxShadow: "0 12px 40px rgba(0,0,0,0.6)"
          }}>
            <div style={{ padding: "4px 8px", fontSize: "10px", color: "var(--tx-mut)", fontWeight: 600, letterSpacing: "0.5px" }}>SELECT WORKFLOW</div>
            {filteredWorkflows.map((wf, idx) => {
              const isSelected = idx === slashIndex;
              return (
                <div
                  key={wf.id || "general"}
                  style={{
                    display: "flex", alignItems: "center", padding: "6px 10px", 
                    background: isSelected ? "rgba(255,255,255,0.1)" : "transparent", 
                    borderRadius: "8px", cursor: "pointer",
                    borderLeft: `2px solid ${isSelected ? wf.color : "transparent"}`
                  }}
                  onMouseEnter={() => setSlashIndex(idx)}
                  onClick={() => {
                    setActiveWorkflowId(wf.id);
                    const match = input.match(/(^|\s)\/([a-zA-Z0-9_-]*)$/);
                    if (match) {
                      const newVal = input.slice(0, match.index) + match[1];
                      setInput(newVal);
                    }
                    setIsSlashOpen(false);
                    textareaRef.current?.focus();
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: 600 }}>{wf.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {input === "" && <div id="placeholder">Ask about your screen or conversation...</div>}
        <textarea
          ref={textareaRef}
          id="input"
          rows={1}
          spellCheck="false"
          value={input}
          disabled={isStreaming}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}

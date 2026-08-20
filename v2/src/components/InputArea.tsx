import { X } from "lucide-react";
interface InputAreaProps {
  input: string;
  setInput: (val: string) => void;
  isStreaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleSend: () => void;
  tags: any[];
  setTags: (tags: any[]) => void;
  activeTagId: string | null;
  setActiveTagId: (id: string | null) => void;
  isLocked: boolean;
}

export function InputArea({ input, setInput, isStreaming, textareaRef, handleSend, tags, setTags, activeTagId, setActiveTagId, isLocked }: InputAreaProps) {
  const activeTag = tags.find(w => w.id === activeTagId);
  
  const generateRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 85%, 60%)`;
  };

  const processTagCommand = (val: string, matchRegExp: RegExp): string | null => {
    if (isLocked) return null;
    const tagMatch = val.match(matchRegExp);
    if (tagMatch) {
      const tagName = tagMatch[1].trim();
      let existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      
      if (!existingTag) {
        existingTag = { id: crypto.randomUUID(), name: tagName, color: generateRandomColor() };
        const newTags = [...tags, existingTag];
        setTags(newTags);
        localStorage.setItem("customTags", JSON.stringify(newTags));
      }
      
      setActiveTagId(existingTag.id);
      return val.replace(tagMatch[0], "").trimStart();
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = e.target.value;
    
    // Check for tag command with a trailing space
    const processedVal = processTagCommand(val, /^\/tag\s+([a-zA-Z0-9_-]+)\s/i);
    if (processedVal !== null) {
      val = processedVal;
    }
    
    setInput(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      
      // Fallback: Check for tag command if they hit enter without a trailing space
      const processedVal = processTagCommand(input, /^\/tag\s+([a-zA-Z0-9_-]+)$/i);
      if (processedVal !== null) {
        setInput(processedVal);
        return; // Don't send message, just process the tag
      }
      
      handleSend();
    }
  };

  return (
    <div id="input-area" style={{ display: "flex", alignItems: "flex-start", gap: "10px", position: "relative" }}>
      
      {activeTagId && (
        <div style={{ position: "relative", zIndex: 10, paddingTop: "2px" }}>
          <div 
            style={{ 
              display: "flex", alignItems: "center", gap: "6px", 
              padding: "4px 10px", background: "rgba(0,0,0,0.4)", 
              border: `1px solid ${activeTag ? activeTag.color : "rgba(255,255,255,0.1)"}`, 
              borderRadius: "16px", 
              opacity: isLocked ? 0.6 : 1,
              whiteSpace: "nowrap"
            }}
            title={isLocked ? "Tag locked for this session" : "Active Tag"}
          >
            <span style={{ color: activeTag ? activeTag.color : "var(--tx-mut)", fontSize: "12px", fontWeight: 700 }}>
              #{activeTag ? activeTag.name : "Unknown"}
            </span>
            {!isLocked && (
              <button 
                onClick={() => setActiveTagId(null)}
                style={{ background: "transparent", border: "none", color: "var(--tx-mut)", cursor: "pointer", display: "flex", alignItems: "center", padding: 0, marginLeft: "4px" }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: "relative" }}>

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

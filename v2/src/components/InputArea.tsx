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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      
      if (!isLocked) {
        const tagMatch = input.match(/^\/tag\s+([a-zA-Z0-9_-]+)(?:\s|$)/i);
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
          setInput(input.replace(tagMatch[0], "").trim());
          return; // Don't send message, just process command
        }
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

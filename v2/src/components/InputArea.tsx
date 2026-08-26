import { useEffect } from "react";
import { emit } from "@tauri-apps/api/event";

interface InputAreaProps {
  input: string;
  setInput: (val: string) => void;
  isStreaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleSend: () => void;
  tags: any[];
  setTags: (tags: any[]) => void;
  activeTagId?: string | null;
  setActiveTagId: (id: string | null) => void;
  isNotebookChat?: boolean;
  isLocked?: boolean;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function InputArea({ input, setInput, isStreaming, textareaRef, handleSend, tags, setTags, activeTagId, setActiveTagId, isNotebookChat, onPaste }: InputAreaProps) {
  useEffect(() => {
    const handleFocus = () => {
      textareaRef.current?.focus();
    };
    window.addEventListener("focus-prompt-input", handleFocus);
    // Autofocus on initial mount and when becoming ready
    const timer1 = setTimeout(handleFocus, 50);
    const timer2 = setTimeout(handleFocus, 200);
    return () => {
      window.removeEventListener("focus-prompt-input", handleFocus);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  const generateRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 85%, 60%)`;
  };

  const applyTagByName = (rawName: string): string | null => {
    if (isNotebookChat) {
      return activeTagId || null;
    }
    const cleanName = rawName.replace(/^#+/, "").trim();
    if (!cleanName) return null;

    let existingTag = tags.find((t) => t.name.toLowerCase() === cleanName.toLowerCase());
    if (!existingTag) {
      existingTag = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        name: cleanName,
        color: generateRandomColor(),
      };
      const newTags = [...tags, existingTag];
      setTags(newTags);
      localStorage.setItem("customTags", JSON.stringify(newTags));
      emit("history-sync", null).catch(() => {});
    }
    setActiveTagId(existingTag.id);
    return existingTag.id;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    
    // Check for tag command when followed by space or newline
    const match = val.match(/^\/(?:tag|t)\s+#?([a-zA-Z0-9_\-\.]+)\s+(.*)$/is);
    if (match) {
      applyTagByName(match[1]);
      setInput(match[2] || "");
      return;
    }
    
    setInput(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const tabSpaces = "    "; // 4 spaces

      if (start === end) {
        if (!e.shiftKey) {
          const updated = input.substring(0, start) + tabSpaces + input.substring(end);
          setInput(updated);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + tabSpaces.length;
            }
          });
        } else {
          // Shift+Tab unindent
          const before = input.substring(0, start);
          const after = input.substring(end);
          const match = before.match(/ {1,4}$/);
          if (match) {
            const removed = match[0].length;
            const updated = before.slice(0, -removed) + after;
            setInput(updated);
            requestAnimationFrame(() => {
              if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start - removed;
              }
            });
          }
        }
      } else {
        // Multi-line selection indent / unindent
        const beforeSelection = input.substring(0, start);
        const lineStart = beforeSelection.lastIndexOf("\n") + 1;
        const selectedText = input.substring(lineStart, end);
        const lines = selectedText.split("\n");

        if (!e.shiftKey) {
          const indented = lines.map((l) => tabSpaces + l).join("\n");
          const updated = input.substring(0, lineStart) + indented + input.substring(end);
          setInput(updated);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = start + tabSpaces.length;
              textareaRef.current.selectionEnd = end + tabSpaces.length * lines.length;
            }
          });
        } else {
          let totalRemovedFirstLine = 0;
          let totalRemoved = 0;
          const unindented = lines
            .map((l, i) => {
              const match = l.match(/^ {1,4}/);
              const count = match ? match[0].length : 0;
              if (i === 0) totalRemovedFirstLine = count;
              totalRemoved += count;
              return l.slice(count);
            })
            .join("\n");

          const updated = input.substring(0, lineStart) + unindented + input.substring(end);
          setInput(updated);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = Math.max(lineStart, start - totalRemovedFirstLine);
              textareaRef.current.selectionEnd = Math.max(lineStart, end - totalRemoved);
            }
          });
        }
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      
      // Check for tag command on Enter
      const match = input.match(/^\/(?:tag|t)\s+#?([a-zA-Z0-9_\-\.]+)(?:\s+(.*)|$)/is);
      if (match) {
        applyTagByName(match[1]);
        const remaining = (match[2] || "").trim();
        setInput(remaining);
        if (remaining) {
          setTimeout(() => handleSend(), 0);
        }
        return;
      }
      
      handleSend();
    }
  };

  return (
    <div id="input-area" style={{ position: "relative" }}>
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
        onPaste={onPaste}
      />
    </div>
  );
}

import { useState, useEffect, Fragment } from "react";
import { Wand, MessageCircle, Zap, Monitor } from "lucide-react";

interface ActionButtonsProps {
  isStreaming: boolean;
  sendPreset: (prompt: string) => void;
}

export function ActionButtons({ isStreaming, sendPreset }: ActionButtonsProps) {
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
  }, []);

  return (
    <div id="action-row" style={{ opacity: isStreaming ? 0.5 : 1, pointerEvents: isStreaming ? 'none' : 'auto' }}>
      {buttons.map((btn: any, i: number) => (
        <Fragment key={i}>
          <button className={`act ${i === 0 ? 'act-primary' : i === 1 ? 'act-secondary' : ''}`} disabled={isStreaming} onClick={() => sendPreset(btn.prompt)}>
            <span className="ic">
              {i === 0 ? <Wand size={14} /> : i === 1 ? <MessageCircle size={14} /> : i === 2 ? <Zap size={14} /> : <Monitor size={14} />}
            </span>
            <span>{btn.label}</span>
          </button>
          {i < buttons.length - 1 && <span className="sep">•</span>}
        </Fragment>
      ))}
    </div>
  );
}

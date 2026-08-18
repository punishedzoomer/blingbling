import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const SLIDES = [
  {
    icon: "👋",
    title: "Welcome to Bling Bling",
    body: "This is your new AI assistant. It sees what you see and helps you work faster."
  },
  {
    icon: "🔍",
    title: "Context Aware",
    body: "Press ⌘⏎ anytime to let the AI scan your screen and anticipate what you need."
  },
  {
    icon: "🚀",
    title: "Ready to go",
    body: "You're all set! Click Done to return to the main window and get started."
  }
];

export function TutorialApp() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    // Focus the window on load
    invoke("focus_panel", { label: "tutorial" }).catch(console.error);
  }, []);

  const handleClose = async () => {
    await invoke("hide_panel", { label: "tutorial" });
  };

  const handleNext = () => {
    if (slide < SLIDES.length - 1) {
      setSlide(slide + 1);
    } else {
      handleClose();
    }
  };

  const current = SLIDES[slide];

  return (
    <div id="onboard" className="glass" style={{ margin: "20px", display: "flex", flexDirection: "column", height: "calc(100vh - 40px)", borderRadius: "16px", padding: "30px", boxSizing: "border-box", overflow: "hidden" }}>
      <div className="ob-dots" id="ob-dots">
        {SLIDES.map((_, i) => (
          <span key={i} className={i === slide ? "on" : ""}></span>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="ob-icon" id="ob-icon">{current.icon}</div>
        <div className="ob-title" id="ob-title" style={{ textAlign: "center" }}>{current.title}</div>
        <div className="ob-body" id="ob-body" style={{ textAlign: "center" }}>{current.body}</div>
      </div>
      
      <div className="ob-actions">
        <button id="ob-skip" className="ob-ghost" onClick={handleClose}>Skip</button>
        <div className="spacer" style={{ flex: 1 }}></div>
        {slide > 0 && (
          <button id="ob-back" className="ob-ghost" onClick={() => setSlide(slide - 1)}>Back</button>
        )}
        <button id="ob-next" className="ob-primary" onClick={handleNext}>
          {slide === SLIDES.length - 1 ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}

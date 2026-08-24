import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sparkles, Scan, CheckCircle2 } from "lucide-react";
import "./App.css";

const SLIDES = [
  {
    icon: Sparkles,
    title: "Welcome to Bling Bling",
    body: "This is your new AI assistant. It sees what you see and helps you work faster."
  },
  {
    icon: Scan,
    title: "Context Aware",
    body: "Press Cmd+Enter anytime to let the AI scan your screen and anticipate what you need."
  },
  {
    icon: CheckCircle2,
    title: "Ready to go",
    body: "You're all set! Click Done to return to the main window and get started."
  }
];

export function TutorialApp({
  isWindowed = false,
  onDone,
}: {
  isWindowed?: boolean;
  onDone?: () => void;
}) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!isWindowed) {
      invoke("focus_panel", { label: "tutorial" }).catch(console.error);
    }
  }, [isWindowed]);

  const handleClose = async () => {
    if (onDone) {
      onDone();
      return;
    }
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
  const IconComponent = current.icon;

  return (
    <div
      id="onboard"
      className={isWindowed ? "windowed-card" : "glass"}
      style={{
        margin: isWindowed ? "0 auto" : "0",
        maxWidth: isWindowed ? "560px" : undefined,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        height: isWindowed ? "100%" : "100vh",
        maxHeight: isWindowed ? "460px" : undefined,
        borderRadius: isWindowed ? "16px" : "20px",
        padding: "24px 28px",
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        pointerEvents: "auto",
      }}
    >
      {!isWindowed && (
        <div 
          data-tauri-drag-region 
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "36px", cursor: "grab", zIndex: 100, backgroundColor: "transparent" }} 
          onMouseDown={(e) => {
            if (e.buttons === 1 && !(e.target as HTMLElement).closest('button')) {
              getCurrentWindow().startDragging();
            }
          }}
        />
      )}
      <div className="ob-dots" id="ob-dots">
        {SLIDES.map((_, i) => (
          <span key={i} className={i === slide ? "on" : ""}></span>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div
          className="ob-icon"
          id="ob-icon"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.08)",
            color: "var(--tx-1)",
            marginBottom: "16px",
          }}
        >
          <IconComponent size={28} />
        </div>
        <div className="ob-title" id="ob-title" style={{ textAlign: "center" }}>{current.title}</div>
        <div className="ob-body" id="ob-body" style={{ textAlign: "center" }}>{current.body}</div>
      </div>
      
      <div className="ob-actions">
        <button id="ob-skip" className="ob-ghost" onClick={handleClose}>{isWindowed ? "Go to Chat" : "Skip"}</button>
        <div className="spacer" style={{ flex: 1 }}></div>
        {slide > 0 && (
          <button id="ob-back" className="ob-ghost" onClick={() => setSlide(slide - 1)}>Back</button>
        )}
        <button id="ob-next" className="ob-primary" onClick={handleNext}>
          {slide === SLIDES.length - 1 ? (isWindowed ? "Get Started" : "Done") : "Next"}
        </button>
      </div>
    </div>
  );
}

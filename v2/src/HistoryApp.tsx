import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import "./App.css";

export function HistoryApp() {
  const [sessions, setSessions] = useState<{id: string, data: any}[]>([]);

  const loadSessions = () => {
    invoke("load_sessions").then((data: any) => {
        const sorted = data.sort((a: any, b: any) => {
          const getTime = (s: any) => {
            if (!isNaN(parseInt(s.id)) && s.id.length > 10) return parseInt(s.id);
            if (s.data && s.data.updated_at) return new Date(s.data.updated_at).getTime();
            return 0;
          };
          return getTime(b) - getTime(a);
        });
        setSessions(sorted);
      }).catch(console.error);
  };

  useEffect(() => {
    loadSessions();
    const unlisten = listen("history-sync", () => {
      loadSessions();
    });

    return () => { unlisten.then((f) => f()); };
  }, []);

  return (
    <div 
      id="history-window" 
      style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}
      onMouseEnter={() => { 
        invoke("focus_panel", { label: "history" }).catch(console.error)
      }} 
    >
      {/* Drag handle for the whole window */}
      <div 
        data-tauri-drag-region 
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40px", cursor: "grab", zIndex: 100 }} 
        onMouseDown={(e) => {
          if (e.buttons === 1 && !(e.target as HTMLElement).closest('button')) {
            getCurrentWindow().startDragging();
          }
        }}
      />
      <div id="transcript-sidebar" className="transcript-sidebar" style={{ position: "relative", top: 0, right: 0, width: "300px", minHeight: "400px", maxHeight: "80vh", margin: 0, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div className="ts-header" style={{ paddingTop: "14px", zIndex: 101 }}>
          <span className="ts-title">Conversations</span>
          <button className="ts-close-btn" id="close-sidebar-btn" onClick={async () => {
                        await invoke("hide_panel", { label: "history" });
          }} title="Close history">✕</button>
        </div>
        <div id="ts-list" className="ts-list" style={{ flex: 1, overflowY: "auto", zIndex: 101 }}>
          {sessions.length === 0 && (
            <div className="ts-placeholder">No conversation history found.</div>
          )}
          {sessions.map((session) => {
            let messages: any[] = [];
            if (Array.isArray(session.data)) {
              messages = session.data;
            } else if (session.data && Array.isArray(session.data.history)) {
              messages = session.data.history;
            }

            const firstUserMsg = messages.find((m: any) => m.role === "user")?.content || "Empty Chat";
            
            let dateStr = "Past Session";
            if (!isNaN(parseInt(session.id)) && session.id.length > 10) {
              dateStr = new Date(parseInt(session.id)).toLocaleString();
            } else if (session.data && session.data.updated_at) {
              dateStr = new Date(session.data.updated_at).toLocaleString();
            }

            return (
              <div 
                key={session.id} 
                className="tc-turn" 
                style={{ cursor: "pointer", display: "flex", flexDirection: "column", padding: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                onClick={async () => {
                                                      await emit("restore-session", { id: session.id, data: messages });
                  await invoke("hide_panel", { label: "history" });
                }}
              >
                <span style={{ fontSize: "11px", color: "var(--tx-mut)", marginBottom: "4px" }}>{dateStr}</span>
                <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {String(firstUserMsg).replace(/\n/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
        <div className="ts-footer" style={{ zIndex: 101 }}>
          <button className="ts-clear-btn" id="clear-transcript-btn" onClick={async () => {
                        await emit("clear-history");
          }}>Clear Current Chat</button>
        </div>
      </div>
    </div>
  );
}

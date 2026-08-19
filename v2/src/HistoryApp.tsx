import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { Trash2, Wand } from "lucide-react";
import "./App.css";

export function HistoryApp() {
  const [sessions, setSessions] = useState<{id: string, data: any}[]>([]);
  const [workflows, setWorkflows] = useState<any[]>(() => {
    const saved = localStorage.getItem("customWorkflows");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "customWorkflows" && e.newValue) {
        setWorkflows(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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


  const renderSession = (session: any) => {
    let messages: any[] = [];
    if (Array.isArray(session.data)) {
      messages = session.data;
    } else if (session.data && Array.isArray(session.data.history)) {
      messages = session.data.history;
    }

    const firstUserMsg = messages.find((m: any) => m.role === "user")?.content || "Empty Chat";
    const displayTitle = session.data?.title || String(firstUserMsg).replace(/\n/g, ' ');
    
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
        style={{ display: "flex", flexDirection: "row", alignItems: "center", padding: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div 
          style={{ flex: 1, cursor: "pointer", display: "flex", flexDirection: "column", overflow: "hidden" }}
          onClick={async () => {
            await emit("restore-session", { id: session.id, data: messages, workflowId: session.data.workflowId, title: session.data.title });
            await invoke("hide_panel", { label: "history" });
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--tx-mut)", marginBottom: "4px" }}>{dateStr}</span>
          <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayTitle}
          </span>
        </div>
        <button 
          className="history-del-btn" 
          style={{ background: "transparent", border: "none", color: "var(--tx-mut)", cursor: "pointer", padding: "4px", marginLeft: "8px" }}
          onClick={async (e) => {
            e.stopPropagation();
            await invoke("delete_session", { sessionId: session.id });
            loadSessions();
          }}
          title="Delete Session"
        >
          <Trash2 size={14} className="hover:text-red-400 transition-colors" />
        </button>
      </div>
    );
  };

  const groupedSessions = workflows.map(wf => ({
    ...wf,
    sessions: sessions.filter(s => s.data && s.data.workflowId === wf.id)
  }));

  const defaultSessions = sessions.filter(s => !s.data || !s.data.workflowId || !workflows.find(w => w.id === s.data.workflowId));

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
        <div className="s-head" style={{ paddingTop: "16px", paddingBottom: "10px", paddingRight: "16px", paddingLeft: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 101 }}>
          <div className="s-title">Conversations</div>
          <button className="s-close" id="close-sidebar-btn" onClick={async () => {
                        await invoke("hide_panel", { label: "history" });
          }} style={{ zIndex: 101 }}>Done</button>
        </div>
        <div id="ts-list" className="ts-list" style={{ flex: 1, overflowY: "auto", zIndex: 101, paddingBottom: "20px" }}>
          <style>{`
            .history-accordion summary::-webkit-details-marker { display: none; }
            .history-accordion summary { list-style: none; }
            .history-accordion summary:hover { background: rgba(255,255,255,0.03); }
          `}</style>
          {sessions.length === 0 && (
            <div className="ts-placeholder" style={{ padding: "20px", color: "var(--tx-mut)", fontSize: "13px", textAlign: "center" }}>No conversation history found.</div>
          )}
          
          {groupedSessions.map((group: any) => group.sessions.length > 0 && (
            <details key={group.id} className="history-accordion" open style={{ marginBottom: "4px" }}>
              <summary style={{ cursor: "pointer", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid rgba(255,255,255,0.02)", userSelect: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", background: "rgba(0,0,0,0.3)", border: `1px solid ${group.color}`, borderRadius: "12px", color: "var(--tx-1)", fontSize: "11px", fontWeight: 500 }}>
                  <Wand size={14} style={{ color: group.color }} />
                  {group.name}
                </div>
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--tx-mut)", fontWeight: 500 }}>{group.sessions.length}</span>
              </summary>
              <div style={{ paddingLeft: "10px", paddingRight: "10px" }}>
                {group.sessions.map((session: any) => renderSession(session))}
              </div>
            </details>
          ))}

          {defaultSessions.length > 0 && (
            <details className="history-accordion" open style={{ marginBottom: "4px" }}>
              <summary style={{ cursor: "pointer", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid rgba(255,255,255,0.02)", userSelect: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", background: "rgba(0,0,0,0.3)", border: `1px solid #3c83f5`, borderRadius: "12px", color: "var(--tx-1)", fontSize: "11px", fontWeight: 500 }}>
                  <Wand size={14} style={{ color: "#3c83f5" }} />
                  General
                </div>
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--tx-mut)", fontWeight: 500 }}>{defaultSessions.length}</span>
              </summary>
              <div style={{ paddingLeft: "10px", paddingRight: "10px" }}>
                {defaultSessions.map((session: any) => renderSession(session))}
              </div>
            </details>
          )}
        </div>

      </div>
    </div>
  );
}

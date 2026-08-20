import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Trash2, Clock, Book, Search, MessageSquare, Plus, Layers, BookOpen, Briefcase, User } from "lucide-react";
import "./App.css";

const MOCK_NOTEBOOKS = [
  { id: 1, title: "ML Research Hub", chats: 12, attachments: 7, time: "Yesterday", color: "#8B5CF6", icon: BookOpen },
  { id: 2, title: "System Design Notes", chats: 8, attachments: 3, time: "4d ago", color: "#06B6D4", icon: BookOpen },
  { id: 3, title: "IELTS Prep 2026", chats: 15, attachments: 11, time: "7d ago", color: "#F59E0B", icon: BookOpen },
  { id: 4, title: "Work Projects Q3", chats: 6, attachments: 4, time: "14d ago", color: "#10B981", icon: Briefcase },
  { id: 5, title: "Personal Journal", chats: 22, attachments: 2, time: "30d ago", color: "#EC4899", icon: User },
];

export function HistoryApp() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"history" | "notebooks">("history");
  const [searchQuery, setSearchQuery] = useState("");

  const loadSessions = () => {
    invoke("get_workflows")
      .then((wfs: any) => setWorkflows(wfs))
      .catch(console.error);

    invoke("get_sessions")
      .then((data: any) => {
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
    const unlisten = listen("history-sync", () => loadSessions());
    return () => { unlisten.then((f) => f()); };
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRelativeDay = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "TODAY";
    if (diffDays === 1) return "YESTERDAY";
    if (diffDays < 7) return "THIS WEEK";
    if (diffDays < 30) return "THIS MONTH";
    return "OLDER";
  };

  const filteredSessions = sessions.filter(s => {
    if (!searchQuery) return true;
    const title = s.data?.title || "";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const groupedSessions = filteredSessions.reduce((acc: any, s: any) => {
    const ts = (!isNaN(parseInt(s.id)) && s.id.length > 10) ? parseInt(s.id) : (s.data?.updated_at ? new Date(s.data.updated_at).getTime() : 0);
    const group = getRelativeDay(ts);
    if (!acc[group]) acc[group] = [];
    acc[group].push({ ...s, ts });
    return acc;
  }, {});

  const groupOrder = ["TODAY", "YESTERDAY", "THIS WEEK", "THIS MONTH", "OLDER"];

  const renderHistoryItem = (session: any) => {
    const displayTitle = session.data?.title || "Empty Chat";
    const wf = workflows.find(w => w.id === session.data?.workflowId);
    
    return (
      <div 
        key={session.id} 
        className="history-item"
        style={{ display: "flex", alignItems: "flex-start", padding: "12px 16px", cursor: "pointer", borderRadius: "8px", position: "relative" }}
        onClick={async () => {
          let messages: any[] = [];
          if (Array.isArray(session.data)) messages = session.data;
          else if (session.data && Array.isArray(session.data.history)) messages = session.data.history;
          await emit("restore-session", { id: session.id, data: messages, workflowId: session.data?.workflowId, title: session.data?.title });
          await invoke("hide_panel", { label: "history" });
        }}
      >
        <div style={{ marginTop: "2px", marginRight: "12px", color: "var(--tx-mut)" }}>
          <MessageSquare size={16} />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "4px" }}>
            {displayTitle}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {wf && (
              <span style={{ color: wf.color, fontSize: "11px", fontWeight: 700 }}>#{wf.name.toLowerCase()}</span>
            )}
          </div>
        </div>
        <div style={{ fontSize: "11px", color: "var(--tx-mut)", marginLeft: "12px", whiteSpace: "nowrap" }}>
          {session.ts ? (getRelativeDay(session.ts) === "TODAY" ? formatTime(session.ts) : new Date(session.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })) : ""}
        </div>
        <button 
          className="history-del-btn" 
          style={{ position: "absolute", right: "12px", top: "12px", background: "var(--bg-2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "var(--tx-mut)", cursor: "pointer", padding: "4px", display: "none" }}
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

  const renderNotebookItem = (nb: any) => {
    const Icon = nb.icon;
    return (
      <div key={nb.id} className="history-item" style={{ display: "flex", alignItems: "center", padding: "12px", cursor: "pointer", borderRadius: "12px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: nb.color, display: "flex", alignItems: "center", justifyContent: "center", marginRight: "16px", flexShrink: 0 }}>
          <Icon size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}>{nb.title}</div>
          <div style={{ color: "var(--tx-mut)", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{nb.chats} chats</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <Layers size={10} /> {nb.attachments}
            </span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span>{nb.time}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      id="history-window" 
      style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      onMouseEnter={() => invoke("focus_panel", { label: "history" }).catch(console.error)} 
    >
      <div id="transcript-sidebar" className="transcript-sidebar" style={{ width: "100%", height: "100%", margin: 0, padding: 0, display: "flex", flexDirection: "column", boxSizing: "border-box", position: "relative" }}>
      <style>{`
        .history-item:hover { background: rgba(255,255,255,0.03); }
        .history-item:hover .history-del-btn { display: block !important; }
        .segment-btn { flex: 1; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.2s; color: var(--tx-mut); }
        .segment-btn.active { background: rgba(255,255,255,0.08); color: #fff; }
        .search-input::placeholder { color: var(--tx-mut); }
      `}</style>

      {/* Header */}
      <div className="s-head" style={{ padding: "16px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 100 }} data-tauri-drag-region onMouseDown={(e) => { if (e.buttons === 1 && !(e.target as HTMLElement).closest('button, input')) getCurrentWindow().startDragging(); }}>
        <div className="s-title" style={{ pointerEvents: "none" }}>Conversations</div>
        <button className="s-close" onClick={() => invoke("hide_panel", { label: "history" })}>Done</button>
      </div>

      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: "12px", flex: 1, overflow: "hidden" }}>
        
        {/* Segmented Control */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "4px" }}>
          <div className={`segment-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <Clock size={16} /> History
          </div>
          <div className={`segment-btn ${activeTab === 'notebooks' ? 'active' : ''}`} onClick={() => setActiveTab('notebooks')}>
            <Book size={16} /> Notebooks
          </div>
        </div>

        {activeTab === 'history' ? (
          <>
            {/* Search Bar */}
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", padding: "10px 14px", gap: "10px" }}>
              <Search size={16} color="var(--tx-mut)" />
              <input 
                type="text" 
                placeholder="Search chats..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "14px", width: "100%" }}
              />
            </div>

            {/* History List */}
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {groupOrder.map(group => {
                const groupSess = groupedSessions[group];
                if (!groupSess || groupSess.length === 0) return null;
                return (
                  <div key={group}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--tx-mut)", letterSpacing: "1px", marginBottom: "8px", marginLeft: "16px" }}>{group}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {groupSess.map((s: any) => renderHistoryItem(s))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(groupedSessions).length === 0 && (
                <div style={{ textAlign: "center", color: "var(--tx-mut)", marginTop: "40px", fontSize: "13px" }}>No chats found.</div>
              )}
            </div>
          </>
        ) : (
          /* Notebooks Tab */
          <div style={{ flex: 1, overflowY: "auto", paddingBottom: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <button style={{ width: "100%", padding: "14px", background: "transparent", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px", color: "var(--tx-mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 500 }} className="history-item">
              <Plus size={16} /> New Notebook
            </button>

            <div style={{ background: "rgba(124, 58, 237, 0.1)", border: "1px solid rgba(124, 58, 237, 0.2)", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
              <Layers size={20} color="#A78BFA" style={{ flexShrink: 0 }} />
              <span style={{ color: "#C4B5FD", fontSize: "13px", lineHeight: "1.4" }}>
                Notebooks share attachments and can read each other's context across chats.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {MOCK_NOTEBOOKS.map(nb => renderNotebookItem(nb))}
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}

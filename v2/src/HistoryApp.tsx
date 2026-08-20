import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Trash2, Clock, Book, Search, MessageSquare, Plus, Layers, BookOpen, Briefcase, User, PenSquare, ChevronDown, ChevronRight } from "lucide-react";
import "./App.css";

const INITIAL_MOCK_NOTEBOOKS = [
  { id: 1, title: "ML Research Hub", chats: 12, attachments: 7, time: "Yesterday", color: "#8B5CF6", icon: BookOpen },
  { id: 2, title: "System Design Notes", chats: 8, attachments: 3, time: "4d ago", color: "#06B6D4", icon: BookOpen },
  { id: 3, title: "IELTS Prep 2026", chats: 15, attachments: 11, time: "7d ago", color: "#F59E0B", icon: BookOpen },
  { id: 4, title: "Work Projects Q3", chats: 6, attachments: 4, time: "14d ago", color: "#10B981", icon: Briefcase },
  { id: 5, title: "Personal Journal", chats: 22, attachments: 2, time: "30d ago", color: "#EC4899", icon: User },
];

export function HistoryApp() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [workflows] = useState<any[]>(() => {
    const saved = localStorage.getItem("customWorkflows");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<"history" | "notebooks">("history");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  const isCollapsed = (group: string) => {
    if (collapsedGroups[group] !== undefined) return collapsedGroups[group];
    return !["Today", "Yesterday", "This Week"].includes(group);
  };
  
  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !isCollapsed(group) }));
  };
  
  // Notebooks state
  const [notebooks, setNotebooks] = useState<any[]>(INITIAL_MOCK_NOTEBOOKS);
  const [editingNbId, setEditingNbId] = useState<number | null>(null);
  const [editNbTitle, setEditNbTitle] = useState("");

  const loadSessions = () => {


    invoke("load_sessions")
      .then((data: any) => {
        const sorted = data.sort((a: any, b: any) => {
          const getTime = (s: any) => {
            const idStr = String(s.id);
            if (idStr.length === 13 && /^1\d{12}$/.test(idStr)) return parseInt(idStr, 10);
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
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getRelativeDay = (ts: number) => {
    if (!ts) return "Earlier";
    const d = new Date(ts);
    const now = new Date();
    
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowDate.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return "This Week";
    
    const isCurrentYear = d.getFullYear() === now.getFullYear();
    const isCurrentMonth = isCurrentYear && d.getMonth() === now.getMonth();
    
    if (isCurrentMonth) return "This Month";
    
    let lastMonth = now.getMonth() - 1;
    let lastMonthYear = now.getFullYear();
    if (lastMonth < 0) {
      lastMonth = 11;
      lastMonthYear -= 1;
    }
    if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) return "Last Month";
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (isCurrentYear) return monthNames[d.getMonth()];
    
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  const filteredSessions = sessions.filter(s => {
    if (!searchQuery) return true;
    const title = s.data?.title || "";
    const wf = workflows.find(w => w.id === s.data?.workflowId);
    const wfName = wf?.name || "";
    return title.toLowerCase().includes(searchQuery.toLowerCase()) || wfName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const groupsMap = new Map<string, any[]>();
  filteredSessions.forEach((s: any) => {
    const idStr = String(s.id);
    const ts = (idStr.length === 13 && /^1\d{12}$/.test(idStr)) ? parseInt(idStr, 10) : (s.data?.updated_at ? new Date(s.data.updated_at).getTime() : 0);
    const group = getRelativeDay(ts);
    if (!groupsMap.has(group)) groupsMap.set(group, []);
    groupsMap.get(group)!.push({ ...s, ts });
  });
  
  const groupOrder = Array.from(groupsMap.keys());
  const groupedSessions: Record<string, any[]> = {};
  groupsMap.forEach((val, key) => groupedSessions[key] = val);

  const handleDelete = async (e: any, id: string) => {
    e.stopPropagation();
    setDeletingIds(prev => [...prev, id]);
    setTimeout(async () => {
      await invoke("delete_session", { sessionId: id });
      setDeletingIds(prev => prev.filter(x => x !== id));
      loadSessions();
    }, 250); // wait for CSS animation
  };

  const renderHistoryItem = (session: any) => {
    let messages: any[] = [];
    if (Array.isArray(session.data)) messages = session.data;
    else if (session.data && Array.isArray(session.data.history)) messages = session.data.history;
    const firstUserMsg = messages.find((m: any) => m.role === "user")?.content || "Empty Chat";
    const displayTitle = session.data?.title || String(firstUserMsg).replace(/\n/g, ' ');
    const wf = workflows.find(w => w.id === session.data?.workflowId);
    const isDeleting = deletingIds.includes(session.id);
    
    return (
      <div 
        key={session.id} 
        className={`history-item ${isDeleting ? 'deleting' : ''}`}
        onClick={async () => {
          if (isDeleting) return;
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
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayTitle}
          </div>
          {wf && (
            <div style={{ display: "inline-flex" }}>
              <div className="tag-pill" style={{ '--tag-color': wf.color } as any}>
                #{wf.name.toLowerCase()}
              </div>
            </div>
          )}
        </div>
        <div style={{ fontSize: "11px", color: "var(--tx-mut)", marginLeft: "12px", marginRight: "32px", whiteSpace: "nowrap", paddingTop: "2px" }}>
          {session.ts ? (getRelativeDay(session.ts) === "Today" ? formatTime(session.ts) : new Date(session.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })) : ""}
        </div>
        <button 
          className="history-del-btn" 
          onClick={(e) => handleDelete(e, session.id)}
          title="Delete Session"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  const handleNewNotebook = () => {
    const newNb = {
      id: Date.now(),
      title: "",
      chats: 0,
      attachments: 0,
      time: "Just now",
      color: "#3B82F6",
      icon: BookOpen
    };
    setNotebooks([newNb, ...notebooks]);
    setEditingNbId(newNb.id);
    setEditNbTitle("");
    setActiveTab("notebooks");
  };

  const saveNotebookTitle = (id: number) => {
    setNotebooks(nbs => nbs.map(nb => nb.id === id ? { ...nb, title: editNbTitle || "Untitled Notebook" } : nb));
    setEditingNbId(null);
  };

  const renderNotebookItem = (nb: any) => {
    const Icon = nb.icon;
    const isEditing = editingNbId === nb.id;
    return (
      <div 
        key={nb.id} 
        className="nb-item"
        onDoubleClick={() => {
          setEditingNbId(nb.id);
          setEditNbTitle(nb.title);
        }}
      >
        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: nb.color, display: "flex", alignItems: "center", justifyContent: "center", marginRight: "16px", flexShrink: 0 }}>
          <Icon size={20} color="#fff" />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {isEditing ? (
            <input 
              autoFocus
              className="nb-edit-input"
              value={editNbTitle}
              onChange={e => setEditNbTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveNotebookTitle(nb.id); if (e.key === 'Escape') setEditingNbId(null); }}
              onBlur={() => saveNotebookTitle(nb.id)}
            />
          ) : (
            <div style={{ color: "#fff", fontSize: "14px", fontWeight: 600, marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nb.title}</div>
          )}
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
      <div id="transcript-sidebar" className="transcript-sidebar" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", margin: 0, padding: 0, display: "flex", flexDirection: "column", boxSizing: "border-box", borderRadius: "16px" }}>
        
        <style>{`
          .history-item { display: flex; align-items: flex-start; padding: 12px 16px; cursor: pointer; border-radius: 8px; position: relative; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); max-height: 80px; opacity: 1; overflow: hidden; margin-bottom: 2px; }
          .history-item.deleting { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; margin-bottom: 0; border: none; }
          .history-item:hover { background: rgba(255,255,255,0.04); }
          
          .history-del-btn { position: absolute; right: 12px; top: 12px; background: var(--bg-2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--tx-mut); cursor: pointer; padding: 6px; opacity: 0; transform: scale(0.9); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; }
          .history-item:hover .history-del-btn { opacity: 1; transform: scale(1); }
          .history-del-btn:hover { color: #ef4444 !important; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1); }
          
          .tag-pill { display: flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; background: color-mix(in srgb, var(--tag-color) 15%, transparent); color: var(--tag-color); }
          
          .segment-container { display: flex; position: relative; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2); }
          .segment-pill { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); background: rgba(255,255,255,0.08); border-radius: 8px; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none; }
          .segment-pill.right { transform: translateX(100%); }
          .segment-btn { flex: 1; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--tx-mut); z-index: 1; transition: color 0.2s; }
          .segment-btn.active { color: #fff; }
          
          .search-input::placeholder { color: var(--tx-mut); }
          
          .views-container { display: flex; width: 200%; flex-shrink: 0; flex: 1; overflow: hidden; transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
          .view-pane { width: 50%; height: 100%; display: flex; flex-direction: column; padding: 0 16px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; }
          
          .group-header { display: flex; align-items: center; font-size: 11px; font-weight: 700; color: var(--tx-mut); letter-spacing: 1px; margin-bottom: 8px; text-transform: uppercase; }
          
          
          .nb-item { display: flex; align-items: center; padding: 12px; cursor: pointer; border-radius: 12px; transition: all 0.2s; margin-bottom: 4px; border: 1px solid transparent; }
          .nb-item:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); }
          .nb-edit-input { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 14px; font-weight: 600; padding: 4px 8px; width: 100%; outline: none; margin-bottom: 2px; }
          .nb-edit-input:focus { border-color: #3B82F6; }
        `}</style>

        {/* Header */}
        <div className="s-head" style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 100, borderBottom: "none" }} data-tauri-drag-region onMouseDown={(e) => { if (e.buttons === 1 && !(e.target as HTMLElement).closest('button, input')) getCurrentWindow().startDragging(); }}>
          <div className="s-title" style={{ pointerEvents: "none" }}>Conversations</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              className="s-close" 
              style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "var(--tx-2)", padding: "6px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="New Chat"
              onClick={async () => {
                await emit("reset-session");
                await invoke("hide_panel", { label: "history" });
              }}
            >
              <PenSquare size={16} />
            </button>
            <button className="s-close" onClick={() => invoke("hide_panel", { label: "history" })}>Done</button>
          </div>
        </div>

        <div style={{ padding: "0 16px", marginBottom: "16px", zIndex: 100 }}>
          {/* Segmented Control */}
          <div className="segment-container">
            <div className={`segment-pill ${activeTab === 'notebooks' ? 'right' : ''}`} />
            <div className={`segment-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
              <Clock size={15} /> History
            </div>
            <div className={`segment-btn ${activeTab === 'notebooks' ? 'active' : ''}`} onClick={() => setActiveTab('notebooks')}>
              <Book size={15} /> Notebooks
            </div>
          </div>
        </div>

        {/* Sliding Views Container */}
        <div className="views-container" style={{ transform: activeTab === 'history' ? 'translateX(0)' : 'translateX(-50%)' }}>
          
          {/* HISTORY PANE */}
          <div className="view-pane">
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", padding: "10px 14px", gap: "10px", marginBottom: "16px", flexShrink: 0 }}>
              <Search size={16} color="var(--tx-mut)" />
              <input 
                type="text" 
                placeholder="Search chats or tags..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "14px", width: "100%" }}
              />
            </div>

            <div style={{ paddingBottom: "20px" }}>
              {groupOrder.map(group => {
                const groupSess = groupedSessions[group];
                if (!groupSess || groupSess.length === 0) return null;
                const collapsed = isCollapsed(group);
                return (
                  <div key={group} style={{ marginBottom: collapsed ? "8px" : "16px" }}>
                    <div className="group-header" onClick={() => toggleGroup(group)} style={{ cursor: "pointer", userSelect: "none" }}>
                      <span style={{ marginRight: "4px", display: "flex", alignItems: "center", color: "var(--tx-mut)" }}>
                        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </span>
                      {group} <span style={{ marginLeft: "6px", opacity: 0.6 }}>{groupSess.length}</span>
                      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)", marginLeft: "12px" }} />
                    </div>
                    {!collapsed && (
                      <div style={{ marginTop: "8px" }}>
                        {groupSess.map((s: any) => renderHistoryItem(s))}
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.keys(groupedSessions).length === 0 && (
                <div style={{ textAlign: "center", color: "var(--tx-mut)", marginTop: "40px", fontSize: "13px" }}>No chats found.</div>
              )}
            </div>
          </div>

          {/* NOTEBOOKS PANE */}
          <div className="view-pane">
            <button 
              onClick={handleNewNotebook}
              style={{ width: "100%", padding: "14px", background: "transparent", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "12px", color: "var(--tx-mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, marginBottom: "16px", transition: "all 0.2s" }} 
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
            >
              <Plus size={16} /> New Notebook
            </button>

            <div style={{ background: "rgba(124, 58, 237, 0.08)", border: "1px solid rgba(124, 58, 237, 0.2)", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
              <Layers size={20} color="#A78BFA" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ color: "#C4B5FD", fontSize: "13px", lineHeight: "1.4" }}>
                Notebooks share attachments and can read each other's context across chats.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {notebooks.map(nb => renderNotebookItem(nb))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

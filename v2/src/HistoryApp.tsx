import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Trash2, Clock, Book, Search, MessageSquare, PenSquare, ChevronDown, ChevronRight } from "lucide-react";
import "./App.css";
import { NotebookList } from "./components/NotebookList";

export function HistoryApp() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [tags] = useState<any[]>(() => {
    const saved = localStorage.getItem("customTags");
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
    const wf = tags.find(w => w.id === s.data?.workflowId);
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
    const tag = tags.find(t => t.id === session.data?.tagId);
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
          await emit("restore-session", { id: session.id, data: messages, tagId: session.data?.tagId, title: session.data?.title });
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
          {tag && (
            <div style={{ display: "inline-flex" }}>
              <div className="tag-pill" style={{ '--tag-color': tag.color } as any}>
                #{tag.name.toLowerCase()}
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


  return (
    <div
      id="history-window"
      style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden", pointerEvents: "none" }}
      onMouseEnter={() => invoke("focus_panel", { label: "history" }).catch(console.error)}
    >
      <div id="transcript-sidebar" className="transcript-sidebar" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", maxHeight: "100%", margin: 0, padding: 0, display: "flex", flexDirection: "column", boxSizing: "border-box", borderRadius: "16px", overflow: "hidden", pointerEvents: "auto" }}>

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

            <div style={{ overflowY: "auto", flex: 1, minHeight: 0, paddingBottom: "20px" }}>
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
          <NotebookList setActiveTab={setActiveTab} />

        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Clock, Book, Trash2, PenSquare } from "lucide-react";
import "./App.css";
import { NotebookList } from "./components/NotebookList";
import { ConversationList, extractMessages } from "./components/ConversationList";
import { ConfirmModal } from "./components/ConfirmModal";

export function HistoryApp() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [trashSessions, setTrashSessions] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>(() => {
    const saved = localStorage.getItem("customTags");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<"history" | "notebooks" | "trash">("history");
  const [searchQuery, setSearchQuery] = useState("");
  const [trashSearchQuery, setTrashSearchQuery] = useState("");
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);

  const loadSessionsData = () => {
    try {
      const saved = localStorage.getItem("customTags");
      if (saved) {
        setTags(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse tags", e);
    }

    invoke("load_sessions")
      .then((data: any) => {
        const sorted = (data || []).sort((a: any, b: any) => {
          const getTime = (s: any) => {
            const idStr = String(s.id);
            if (idStr.length === 13 && /^1\d{12}$/.test(idStr)) return parseInt(idStr, 10);
            if (s.data && s.data.updated_at) return new Date(s.data.updated_at).getTime();
            return 0;
          };
          return getTime(b) - getTime(a);
        });
        setSessions(sorted);
      })
      .catch(console.error);

    invoke("load_trash")
      .then((data: any) => {
        const sorted = (data || []).sort((a: any, b: any) => {
          const getTime = (s: any) => {
            const idStr = String(s.id);
            if (idStr.length === 13 && /^1\d{12}$/.test(idStr)) return parseInt(idStr, 10);
            if (s.data && s.data.updated_at) return new Date(s.data.updated_at).getTime();
            return 0;
          };
          return getTime(b) - getTime(a);
        });
        setTrashSessions(sorted);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadSessionsData();

    const handleStorage = (e: StorageEvent) => {
      if ((e.key === "customTags" || e.key === "customWorkflows") && e.newValue) {
        try {
          setTags(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", loadSessionsData);

    const unlisten = listen("history-sync", () => loadSessionsData());
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", loadSessionsData);
      unlisten.then((f) => f());
    };
  }, []);

  const handleDeleteToTrash = async (e: any, id: string) => {
    e.stopPropagation();
    const item = sessions.find((s) => s.id === id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (item) {
      setTrashSessions((prev) => [item, ...prev]);
    }
    try {
      await invoke("delete_session", { sessionId: id });
    } catch (err) {
      console.error("Failed to delete session to trash:", err);
      loadSessionsData();
    }
  };

  const handleRestoreFromTrash = async (id: string) => {
    const item = trashSessions.find((s) => s.id === id);
    setTrashSessions((prev) => prev.filter((s) => s.id !== id));
    if (item) {
      setSessions((prev) => [item, ...prev]);
    }
    try {
      await invoke("restore_session", { sessionId: id });
      await emit("history-sync", null);
    } catch (err) {
      console.error("Failed to restore session from trash:", err);
      loadSessionsData();
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setTrashSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await invoke("permanently_delete_session", { sessionId: id });
    } catch (err) {
      console.error("Failed to permanently delete session:", err);
      loadSessionsData();
    }
  };

  const handleEmptyTrash = async () => {
    setTrashSessions([]);
    setShowEmptyTrashConfirm(false);
    try {
      await invoke("empty_trash");
    } catch (err) {
      console.error("Failed to empty trash:", err);
      loadSessionsData();
    }
  };

  const handleSelectSession = async (session: any) => {
    const messages = extractMessages(session.data);
    await emit("restore-session", {
      id: String(session.id),
      data: messages,
      tagId: session.data?.tagId,
      notebookId: session.data?.notebookId,
      title: session.data?.title,
    });
    await invoke("open_main_chat");
  };

  return (
    <div
      id="history-window"
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        overflow: "hidden",
        pointerEvents: "none",
        position: "relative",
      }}
      onMouseEnter={() => invoke("focus_panel", { label: "history" }).catch(console.error)}
    >
      <div
        id="transcript-sidebar"
        className="transcript-sidebar"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          maxHeight: "100%",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          borderRadius: "16px",
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        <style>{`
          .history-item { display: flex; align-items: center; padding: 10px 12px; cursor: pointer; border-radius: 8px; position: relative; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
          .history-item:hover { background: rgba(255,255,255,0.04); }
          .history-del-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%) scale(0.9); background: var(--bg-2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--tx-mut); cursor: pointer; padding: 5px; opacity: 0; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; }
          .history-item:hover .history-del-btn { opacity: 1; transform: translateY(-50%) scale(1); }
          .history-del-btn:hover { color: #ef4444 !important; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1); }
          .tag-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 12px; font-size: 10px; font-weight: 700; background: color-mix(in srgb, var(--tag-color) 15%, transparent); color: var(--tag-color); flex-shrink: 0; white-space: nowrap; }
          .segment-container { display: flex; position: relative; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2); }
          .segment-pill { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(33.333% - 3px); background: rgba(255,255,255,0.08); border-radius: 8px; transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none; }
          .segment-btn { flex: 1; padding: 7px 4px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--tx-mut); z-index: 1; transition: color 0.2s; white-space: nowrap; }
          .segment-btn.active { color: #fff; }
          .search-input::placeholder { color: var(--tx-mut); }
          .views-container { display: flex; width: 300%; flex-shrink: 0; flex: 1; overflow: hidden; transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
          .view-pane { width: 33.3333%; height: 100%; display: flex; flex-direction: column; padding: 0 16px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; }
        `}</style>

        {/* Header */}
        <div
          className="s-head"
          style={{
            padding: "16px 16px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 100,
            borderBottom: "none",
          }}
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.buttons === 1 && !(e.target as HTMLElement).closest("button, input")) {
              getCurrentWindow().startDragging();
            }
          }}
        >
          <div className="s-title" style={{ pointerEvents: "none" }}>
            Conversations
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="s-close"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "none",
                color: "var(--tx-2)",
                padding: "6px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="New Chat"
              onClick={async () => {
                await emit("reset-session");
                await invoke("hide_panel", { label: "history" });
              }}
            >
              <PenSquare size={16} />
            </button>
            <button className="s-close" onClick={() => invoke("hide_panel", { label: "history" })}>
              Done
            </button>
          </div>
        </div>

        {/* 3-Tab Segmented Control */}
        <div style={{ padding: "0 16px", marginBottom: "16px", zIndex: 100 }}>
          <div className="segment-container">
            <div
              className="segment-pill"
              style={{
                transform:
                  activeTab === "history"
                    ? "translateX(0)"
                    : activeTab === "notebooks"
                    ? "translateX(100%)"
                    : "translateX(200%)",
              }}
            />
            <div
              className={`segment-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <Clock size={14} /> History
            </div>
            <div
              className={`segment-btn ${activeTab === "notebooks" ? "active" : ""}`}
              onClick={() => setActiveTab("notebooks")}
            >
              <Book size={14} /> Notebooks
            </div>
            <div
              className={`segment-btn ${activeTab === "trash" ? "active" : ""}`}
              onClick={() => setActiveTab("trash")}
            >
              <Trash2 size={14} /> Trash {trashSessions.length > 0 && `(${trashSessions.length})`}
            </div>
          </div>
        </div>

        {/* Sliding Views Container */}
        <div
          className="views-container"
          style={{
            transform:
              activeTab === "history"
                ? "translateX(0)"
                : activeTab === "notebooks"
                ? "translateX(-33.3333%)"
                : "translateX(-66.6666%)",
          }}
        >
          {/* 1. HISTORY PANE */}
          <div className="view-pane">
            <ConversationList
              sessions={sessions}
              tags={tags}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSelectSession={handleSelectSession}
              actionType="delete"
              onActionClick={(e, s) => handleDeleteToTrash(e, s.id)}
              emptyMessage="No chats found."
            />
          </div>

          {/* 2. NOTEBOOKS PANE */}
          <NotebookList setActiveTab={setActiveTab} />

          {/* 3. TRASH PANE */}
          <div className="view-pane">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
                padding: "0 2px",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--tx-mut)" }}>
                {trashSessions.length} deleted conversation{trashSessions.length === 1 ? "" : "s"}
              </span>
              {trashSessions.length > 0 && (
                <button
                  onClick={() => setShowEmptyTrashConfirm(true)}
                  style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    borderRadius: "6px",
                    color: "#ef4444",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "4px 8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)")}
                >
                  Empty Trash
                </button>
              )}
            </div>

            <ConversationList
              sessions={trashSessions}
              tags={tags}
              searchQuery={trashSearchQuery}
              onSearchQueryChange={setTrashSearchQuery}
              searchPlaceholder="Search deleted chats..."
              onSelectSession={(s) => handleRestoreFromTrash(s.id)}
              actionType="restore"
              onActionClick={(_e, s) => handleRestoreFromTrash(s.id)}
              secondaryActionType="delete"
              onSecondaryActionClick={(_e, s) => handlePermanentDelete(s.id)}
              showGroups={true}
              emptyMessage="Trash is empty."
            />
          </div>
        </div>

        {/* Empty Trash Confirmation Modal */}
        <ConfirmModal
          isOpen={showEmptyTrashConfirm}
          title="Empty Trash?"
          message="Are you sure you want to permanently delete all conversations in the trash? This cannot be undone."
          confirmLabel="Empty Trash"
          cancelLabel="Cancel"
          danger={true}
          onConfirm={handleEmptyTrash}
          onCancel={() => setShowEmptyTrashConfirm(false)}
        />
      </div>
    </div>
  );
}

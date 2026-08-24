import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Clock, Trash2, PenSquare } from "lucide-react";
import "./App.css";
import { ConversationList, extractMessages } from "./components/ConversationList";
import { ConfirmModal } from "./components/ConfirmModal";
import { useSessionsStore } from "./utils/sessionStore";

export function HistoryApp({
  isWindowed = false,
  initialTab = "history",
  onOpenChat,
}: {
  isWindowed?: boolean;
  initialTab?: "history" | "trash";
  onOpenChat?: () => void;
} = {}) {
  const {
    sessions,
    trashSessions,
    deleteSessionToTrash,
    restoreSessionFromTrash,
    permanentlyDeleteSession,
    emptyAllTrash,
  } = useSessionsStore();

  const [tags, setTags] = useState<any[]>(() => {
    const saved = localStorage.getItem("customTags");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<"history" | "trash">(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set([initialTab]));
  const [searchQuery, setSearchQuery] = useState("");
  const [trashSearchQuery, setTrashSearchQuery] = useState("");
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
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
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleDeleteToTrash = async (e: any, id: string) => {
    e.stopPropagation();
    await deleteSessionToTrash(id);
  };

  const handleRestoreFromTrash = async (id: string) => {
    await restoreSessionFromTrash(id);
  };

  const handlePermanentDelete = async (id: string) => {
    await permanentlyDeleteSession(id);
  };

  const handleEmptyTrash = async () => {
    setShowEmptyTrashConfirm(false);
    await emptyAllTrash();
  };

  const handleSelectSession = async (session: any) => {
    const messages = extractMessages(session.data);
    const payload = {
      id: String(session.id),
      data: messages,
      tagId: session.data?.tagId,
      notebookId: session.data?.notebookId,
      title: session.data?.title,
    };

    window.dispatchEvent(new CustomEvent("app-restore-session", { detail: payload }));
    emit("restore-session", payload).catch(() => {});

    if (onOpenChat) {
      onOpenChat();
    } else {
      await invoke("open_main_chat");
    }
  };

  return (
    <div
      id="history-window"
      className={isWindowed ? "windowed-pane" : undefined}
      style={{
        width: isWindowed ? "100%" : "100vw",
        maxWidth: isWindowed ? "800px" : undefined,
        margin: isWindowed ? "0 auto" : undefined,
        height: isWindowed ? "100%" : "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        overflow: "hidden",
        pointerEvents: isWindowed ? "auto" : "none",
        position: "relative",
      }}
      onMouseEnter={() => {
        if (!isWindowed) {
          invoke("focus_panel", { label: "history" }).catch(console.error);
        }
      }}
    >
      <div
        id="transcript-sidebar"
        className={isWindowed ? undefined : "transcript-sidebar"}
        style={
          isWindowed
            ? {
                display: "flex",
                flexDirection: "column",
                flex: 1,
                width: "100%",
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
                boxSizing: "border-box",
              }
            : {
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
              }
        }
      >
        <style>{`
          .history-item { display: flex; align-items: center; padding: 10px 12px; cursor: pointer; border-radius: 8px; position: relative; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
          .history-item:hover { background: rgba(255,255,255,0.04); }
          .history-del-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%) scale(0.9); background: var(--bg-2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--tx-mut); cursor: pointer; padding: 5px; opacity: 0; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; }
          .history-item:hover .history-del-btn { opacity: 1; transform: translateY(-50%) scale(1); }
          .history-del-btn:hover { color: #ef4444 !important; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1); }
          .tag-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 12px; font-size: 10px; font-weight: 700; background: color-mix(in srgb, var(--tag-color) 15%, transparent); color: var(--tag-color); flex-shrink: 0; white-space: nowrap; }
          .segment-container { display: flex; position: relative; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2); }
          .segment-pill-2 { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px); background: rgba(255,255,255,0.08); border-radius: 8px; transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(0,0,0,0.2); pointer-events: none; }
          .segment-btn { flex: 1; padding: 7px 4px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--tx-mut); z-index: 1; transition: color 0.2s; white-space: nowrap; }
          .segment-btn.active { color: #fff; }
          .search-input::placeholder { color: var(--tx-mut); }
          .views-container-2 { display: flex; width: 200%; flex-shrink: 0; flex: 1; overflow: hidden; transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
          .view-pane-2 { width: 50%; height: 100%; display: flex; flex-direction: column; padding: 0 16px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; }
        `}</style>

        {/* Header (widget mode only) */}
        {!isWindowed && (
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
        )}

        {/* 2-Tab Segmented Control (History / Trash) */}
        <div style={{ padding: "0 16px", marginBottom: "16px", zIndex: 100 }}>
          <div className="segment-container">
            <div
              className="segment-pill-2"
              style={{
                transform: activeTab === "history" ? "translateX(0)" : "translateX(100%)",
              }}
            />
            <div
              className={`segment-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <Clock size={14} /> History ({sessions.length})
            </div>
            <div
              className={`segment-btn ${activeTab === "trash" ? "active" : ""}`}
              onClick={() => setActiveTab("trash")}
            >
              <Trash2 size={14} /> Trash {trashSessions.length > 0 && `(${trashSessions.length})`}
            </div>
          </div>
        </div>

        {/* 2-Pane Container */}
        <div
          className="views-container-2"
          style={{
            transform: activeTab === "history" ? "translateX(0)" : "translateX(-50%)",
          }}
        >
          {/* 1. HISTORY PANE */}
          <div className="view-pane-2">
            {visitedTabs.has("history") && (
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
            )}
          </div>

          {/* 2. TRASH PANE */}
          <div className="view-pane-2">
            {visitedTabs.has("trash") && (
              <>
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
            </>
            )}
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

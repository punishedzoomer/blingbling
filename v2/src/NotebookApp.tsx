import { useState, useEffect, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { BookOpen, Pencil, Trash2, Check, X, Plus, History, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import "./App.css";
import { syncNotebookTag, updateNotebookTagName } from "./utils/notebookTags";
import { ConfirmModal } from "./components/ConfirmModal";
import { useSessionsStore } from "./utils/sessionStore";
import {
  ConversationList,
  extractMessages,
  normalizeSessionData,
} from "./components/ConversationList";

function getNotebookId(): number | null {
  const id = localStorage.getItem("activeNotebookId");
  return id ? parseInt(id, 10) : null;
}

function loadNotebooks(): any[] {
  try {
    return JSON.parse(localStorage.getItem("customNotebooks") || "[]");
  } catch {
    return [];
  }
}

function saveNotebooks(notebooks: any[]) {
  localStorage.setItem("customNotebooks", JSON.stringify(notebooks));
}

export function NotebookApp({
  isWindowed = false,
  notebookId: propNotebookId,
  onOpenChat,
  onOpenHistory,
  onBack,
}: {
  isWindowed?: boolean;
  notebookId?: number | null;
  onOpenChat?: () => void;
  onOpenHistory?: () => void;
  onBack?: () => void;
} = {}) {
  const { sessions: allSessions, updateSessionData } = useSessionsStore();
  const [notebook, setNotebook] = useState<any | null>(null);
  const [tags, setTags] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("customTags") || "[]");
    } catch {
      return [];
    }
  });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [notebookSearchQuery, setNotebookSearchQuery] = useState("");

  const loadTags = useCallback(() => {
    try {
      const saved = localStorage.getItem("customTags");
      if (saved) setTags(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load tags:", e);
    }
  }, []);

  const loadNotebook = useCallback(async () => {
    const id = propNotebookId !== undefined ? propNotebookId : getNotebookId();
    if (!id) {
      setNotebook(null);
      return;
    }
    const nbs = loadNotebooks();
    const found = nbs.find((nb: any) => nb.id === id);
    if (found) {
      setNotebook(found);
      syncNotebookTag(found);
      loadTags();
    } else {
      setNotebook(null);
    }
    setIsRenaming(false);
    setRenameValue("");
  }, [propNotebookId, loadTags]);

  useEffect(() => {
    loadNotebook();
    loadTags();

    const onStorage = (e: StorageEvent) => {
      if ((e.key === "customTags" || e.key === "customNotebooks") && e.newValue) {
        try {
          if (e.key === "customTags") setTags(JSON.parse(e.newValue));
          if (e.key === "customNotebooks") loadNotebook();
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [loadNotebook, loadTags]);

  if (!notebook) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--tx-mut)",
          fontSize: "14px",
        }}
      >
        Notebook not found.
      </div>
    );
  }

  const notebookId = getNotebookId();
  // Filter sessions in this notebook
  const notebookSessions = allSessions.filter(
    (s: any) => String(s.data?.notebookId) === String(notebookId)
  );
  // Filter sessions NOT in this notebook (prevent duplicate listing)
  const unassignedSessions = allSessions.filter(
    (s: any) => String(s.data?.notebookId) !== String(notebookId)
  );

  const saveRename = () => {
    const trimmed = renameValue.trim() || "Untitled Notebook";
    const oldTitle = notebook.title;
    const updated = loadNotebooks().map((nb: any) =>
      String(nb.id) === String(notebookId) ? { ...nb, title: trimmed } : nb
    );
    saveNotebooks(updated);
    setNotebook((prev: any) => ({ ...prev, title: trimmed }));
    updateNotebookTagName(notebook.id, oldTitle, trimmed, notebook.color);
    loadTags();
    setIsRenaming(false);
  };

  const handleDone = async () => {
    if (onOpenHistory) {
      onOpenHistory();
      return;
    }
    await invoke("hide_notebook");
    await invoke("show_panel", { label: "history" });
  };

  const handleDelete = async () => {
    const id = propNotebookId !== undefined ? propNotebookId : getNotebookId();
    const updated = loadNotebooks().filter((nb: any) => String(nb.id) !== String(id));
    saveNotebooks(updated);

    for (const session of notebookSessions) {
      const normalized = normalizeSessionData(session.data);
      const updatedData = { ...normalized };
      delete updatedData.notebookId;
      await invoke("save_session", { sessionId: session.id, data: updatedData }).catch(console.error);
    }

    await emit("history-sync", null);
    if (onBack) {
      onBack();
    } else if (onOpenHistory) {
      onOpenHistory();
    } else {
      await invoke("hide_notebook");
      await invoke("show_panel", { label: "history" });
    }
  };

  const assignSession = async (sessionId: string) => {
    const notebookId = propNotebookId !== undefined ? propNotebookId : getNotebookId();
    if (!notebookId || !notebook) return;

    if (notebookSessions.some((s: any) => String(s.id) === String(sessionId))) {
      setShowAddPanel(false);
      return;
    }

    const session = allSessions.find((s: any) => String(s.id) === String(sessionId));
    if (!session) return;

    const tag = syncNotebookTag(notebook);
    const normalized = normalizeSessionData(session.data);
    const updatedData = {
      ...normalized,
      notebookId,
      tagId: tag.id,
    };

    setShowAddPanel(false);
    await updateSessionData(String(sessionId), updatedData);
  };

  const removeSession = async (sessionId: string) => {
    const session = allSessions.find((s: any) => String(s.id) === String(sessionId));
    if (!session) return;

    const normalized = normalizeSessionData(session.data);
    const updatedData = { ...normalized };
    delete updatedData.notebookId;

    await updateSessionData(String(sessionId), updatedData);
  };

  const openSession = async (session: any) => {
    try {
      const currentSession = allSessions.find((s: any) => String(s.id) === String(session.id)) || session;
      const messages = extractMessages(currentSession.data);
      const tag = syncNotebookTag(notebook);
      const tagId = currentSession.data?.tagId || tag.id;

      const payload = {
        id: String(currentSession.id),
        data: messages,
        tagId,
        notebookId: notebook.id,
        title: currentSession.data?.title,
      };

      window.dispatchEvent(new CustomEvent("app-restore-session", { detail: payload }));
      emit("restore-session", payload).catch(() => {});

      if (onOpenChat) {
        onOpenChat();
      } else {
        await invoke("open_main_chat");
      }
    } catch (err: any) {
      console.error("Failed in openSession:", err);
    }
  };

  const handleNewChatInNotebook = async () => {
    try {
      const newSessionId = Date.now().toString();
      const tag = syncNotebookTag(notebook);

      const payload = {
        id: newSessionId,
        data: [],
        tagId: tag.id,
        notebookId: notebook.id,
        title: null,
      };

      window.dispatchEvent(new CustomEvent("app-restore-session", { detail: payload }));
      emit("restore-session", payload).catch(() => {});

      if (onOpenChat) {
        onOpenChat();
      } else {
        await invoke("open_main_chat");
      }
    } catch (err: any) {
      console.error("Failed in handleNewChatInNotebook:", err);
    }
  };

  return (
    <div
      id="notebook-window"
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
          invoke("focus_panel", { label: "notebook" }).catch(console.error);
        }
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          overflow: "hidden",
          background: "rgba(20, 22, 28, 0.94)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          backdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
          pointerEvents: "auto",
        }}
      >
        <style>{`
          .history-item { display: flex; align-items: center; padding: 10px 12px; cursor: pointer; border-radius: 8px; position: relative; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid transparent; }
          .history-item:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.07); }
          .history-del-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%) scale(0.9); background: var(--bg-2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--tx-mut); cursor: pointer; padding: 5px; opacity: 0; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
          .history-item:hover .history-del-btn { opacity: 1; transform: translateY(-50%) scale(1); }
          .history-del-btn:hover { color: #ef4444 !important; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); }
          .tag-pill { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 12px; font-size: 10px; font-weight: 700; background: color-mix(in srgb, var(--tag-color) 15%, transparent); color: var(--tag-color); flex-shrink: 0; white-space: nowrap; }
        `}</style>

        {/* Header */}
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.buttons === 1 && !(e.target as HTMLElement).closest("button, input")) {
              getCurrentWindow().startDragging();
            }
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: notebook.color || "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            <BookOpen size={16} color="#fff" />
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                placeholder="Notebook name..."
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "4px 8px",
                  width: "100%",
                  outline: "none",
                }}
              />
            ) : (
              <div
                style={{
                  pointerEvents: "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "rgba(255,255,255,0.95)",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                {notebook.title}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            {onBack && (
              <button
                className="s-close"
                style={{
                  padding: "5px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.85)",
                }}
                onClick={onBack}
                title="Back to all notebooks"
              >
                <ArrowLeft size={13} />
                <span>All Notebooks</span>
              </button>
            )}
            {isRenaming ? (
              <>
                <button
                  className="s-close"
                  style={{
                    padding: 6,
                    background: "rgba(34,197,94,0.15)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    color: "#4ade80",
                  }}
                  onClick={saveRename}
                  title="Save Name"
                >
                  <Check size={14} />
                </button>
                <button
                  className="s-close"
                  style={{ padding: 6 }}
                  onClick={() => setIsRenaming(false)}
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                className="s-close"
                style={{ padding: 6 }}
                onClick={() => {
                  setRenameValue(notebook.title);
                  setIsRenaming(true);
                }}
                title="Rename Notebook"
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              className="s-close"
              style={{ padding: 6 }}
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete Notebook"
            >
              <Trash2 size={14} color="#ef4444" />
            </button>
            {!isWindowed && (
              <button className="s-close" onClick={handleDone}>
                Done
              </button>
            )}
          </div>
        </div>

        {/* Action Bar: Dual Action Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            padding: "12px 16px 8px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleNewChatInNotebook}
            style={{
              padding: "9px 12px",
              background: `color-mix(in srgb, ${notebook.color || "var(--accent)"} 22%, transparent)`,
              border: `1px solid color-mix(in srgb, ${notebook.color || "var(--accent)"} 45%, transparent)`,
              borderRadius: "10px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            title="Start a new conversation tagged with this notebook"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>

          <button
            onClick={() => setShowAddPanel((prev) => !prev)}
            style={{
              padding: "9px 12px",
              background: showAddPanel ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              color: "var(--tx-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            title="Add existing conversation from history"
          >
            <History size={14} color="var(--tx-mut)" />
            <span>Add from History</span>
            {showAddPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "8px 16px 16px",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* History Selection Dropdown Drawer */}
          {showAddPanel && (
            <div
              style={{
                marginBottom: "14px",
                padding: "10px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                maxHeight: "220px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--tx-mut)",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  padding: "2px 4px 6px",
                  flexShrink: 0,
                }}
              >
                Select a Chat to Add
              </div>

              <ConversationList
                sessions={unassignedSessions}
                tags={tags}
                searchQuery={historySearchQuery}
                onSearchQueryChange={setHistorySearchQuery}
                showSearch={true}
                searchPlaceholder="Search history to add..."
                onSelectSession={(s) => assignSession(s.id)}
                actionType="add"
                onActionClick={(_e, s) => assignSession(s.id)}
                compact={true}
                showGroups={false}
                emptyMessage="All conversations are already assigned."
              />
            </div>
          )}

          {/* Notebook Conversations List */}
          {notebookSessions.length === 0 && !showAddPanel ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--tx-mut)",
                marginTop: 36,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  marginBottom: 12,
                  opacity: 0.3,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <BookOpen size={28} />
              </div>
              <div>No conversations in this notebook yet.</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                Click <strong>New Chat</strong> to begin or <strong>Add from History</strong>.
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <ConversationList
                sessions={notebookSessions}
                tags={tags}
                searchQuery={notebookSearchQuery}
                onSearchQueryChange={setNotebookSearchQuery}
                showSearch={notebookSessions.length > 3}
                searchPlaceholder="Search chats in notebook..."
                onSelectSession={openSession}
                actionType="remove"
                onActionClick={(_e, s) => removeSession(s.id)}
                notebookColor={notebook.color}
                showGroups={true}
                emptyMessage="No matching chats in this notebook."
              />
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Delete Notebook?"
          message={`Are you sure you want to delete "${notebook.title}"? Conversations will remain in your history, but will be unassigned from this notebook.`}
          confirmLabel="Delete Notebook"
          cancelLabel="Cancel"
          danger={true}
          onConfirm={async () => {
            setShowDeleteConfirm(false);
            await handleDelete();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    </div>
  );
}

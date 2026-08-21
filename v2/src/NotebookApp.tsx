import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { BookOpen, Pencil, Trash2, Check, X, MessageSquare, Plus } from "lucide-react";
import "./App.css";

function getNotebookId(): number | null {
  const id = localStorage.getItem("activeNotebookId");
  return id ? parseInt(id, 10) : null;
}

function loadNotebooks(): any[] {
  try { return JSON.parse(localStorage.getItem("customNotebooks") || "[]"); }
  catch { return []; }
}

function saveNotebooks(notebooks: any[]) {
  localStorage.setItem("customNotebooks", JSON.stringify(notebooks));
}

export function NotebookApp() {
  const [notebook, setNotebook] = useState<any | null>(null);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);

  const loadNotebook = () => {
    const id = getNotebookId();
    if (!id) return;
    const nbs = loadNotebooks();
    const found = nbs.find((nb: any) => nb.id === id);
    setNotebook(found || null);
    // Always reset rename mode when loading a (possibly different) notebook
    setIsRenaming(false);
    setRenameValue("");
  };

  useEffect(() => {
    loadNotebook();
    // Reload notebook data whenever this window is focused (new notebook may have been selected)
    window.addEventListener("focus", loadNotebook);
    return () => window.removeEventListener("focus", loadNotebook);
  }, []);

  useEffect(() => {
    invoke("load_sessions").then((data: any) => setAllSessions(data)).catch(console.error);
  }, []);

  if (!notebook) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--tx-mut)", fontSize: "14px" }}>
        Notebook not found.
      </div>
    );
  }

  const notebookId = getNotebookId();
  const notebookSessions = allSessions.filter((s: any) => s.data?.notebookId === notebookId);
  const unassignedSessions = allSessions.filter((s: any) => !s.data?.notebookId);

  const saveRename = () => {
    const trimmed = renameValue.trim() || "Untitled Notebook";
    const updated = loadNotebooks().map((nb: any) =>
      nb.id === notebookId ? { ...nb, title: trimmed } : nb
    );
    saveNotebooks(updated);
    setNotebook((prev: any) => ({ ...prev, title: trimmed }));
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    const updated = loadNotebooks().filter((nb: any) => nb.id !== notebookId);
    saveNotebooks(updated);
    await invoke("hide_notebook");
  };

  const assignSession = async (sessionId: string) => {
    const notebookId = getNotebookId();
    const session = allSessions.find((s: any) => s.id === sessionId);
    if (!session) return;
    const updatedData = { ...(session.data || {}), notebookId };
    await invoke("save_session", { sessionId, data: updatedData }).catch(console.error);
    const fresh: any = await invoke("load_sessions").catch(() => allSessions);
    setAllSessions(fresh);
    setShowAddPanel(false);
  };

  const removeSession = async (sessionId: string) => {
    const session = allSessions.find((s: any) => s.id === sessionId);
    if (!session) return;
    const updatedData = { ...(session.data || {}) };
    delete updatedData.notebookId;
    await invoke("save_session", { sessionId, data: updatedData }).catch(console.error);
    const fresh: any = await invoke("load_sessions").catch(() => allSessions);
    setAllSessions(fresh);
  };

  const openSession = async (session: any) => {
    let messages: any[] = [];
    if (Array.isArray(session.data)) messages = session.data;
    else if (session.data && Array.isArray(session.data.history)) messages = session.data.history;
    await emit("restore-session", { id: session.id, data: messages, tagId: session.data?.tagId, title: session.data?.title });
    await invoke("hide_notebook");
  };

  const getSessionTitle = (session: any): string => {
    let messages: any[] = [];
    if (Array.isArray(session.data)) messages = session.data;
    else if (session.data && Array.isArray(session.data.history)) messages = session.data.history;
    const first = messages.find((m: any) => m.role === "user")?.content || "Empty Chat";
    return session.data?.title || String(first).replace(/\n/g, " ").slice(0, 60);
  };

  return (
    <div
      style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      onMouseEnter={() => invoke("focus_panel", { label: "notebook" }).catch(console.error)}
    >
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        borderRadius: "16px", overflow: "hidden",
        background: "rgba(20,22,28,0.92)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        backdropFilter: "blur(40px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}>

        {/* Header */}
        <div
          style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.buttons === 1 && !(e.target as HTMLElement).closest("button, input")) {
              getCurrentWindow().startDragging();
            }
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: notebook.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BookOpen size={16} color="#fff" />
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setIsRenaming(false); }}
                placeholder="Notebook name..."
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#fff", fontSize: 14, fontWeight: 600, padding: "4px 8px", width: "100%", outline: "none" }}
              />
            ) : (
              <div style={{ pointerEvents: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(255,255,255,0.95)", fontSize: "15px", fontWeight: 600 }}>
                {notebook.title}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isRenaming ? (
              <>
                <button className="s-close" style={{ padding: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }} onClick={saveRename} title="Save">
                  <Check size={14} />
                </button>
                <button className="s-close" style={{ padding: 6 }} onClick={() => setIsRenaming(false)} title="Cancel">
                  <X size={14} />
                </button>
              </>
            ) : (
              <button className="s-close" style={{ padding: 6 }} onClick={() => { setRenameValue(notebook.title); setIsRenaming(true); }} title="Rename">
                <Pencil size={14} />
              </button>
            )}
            <button className="s-close" style={{ padding: 6 }} onClick={handleDelete} title="Delete Notebook">
              <Trash2 size={14} color="#ef4444" />
            </button>
            <button className="s-close" onClick={() => invoke("hide_notebook")}>Done</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 16px" }}>

          {notebookSessions.length === 0 && !showAddPanel ? (
            <div style={{ textAlign: "center", color: "var(--tx-mut)", marginTop: 48, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 12, opacity: 0.3, display: "flex", justifyContent: "center" }}><BookOpen size={28} /></div>
              <div>No chats in this notebook yet.</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>Add conversations from your history below.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
              {notebookSessions.map((session: any) => (
                <div
                  key={session.id}
                  className="history-item"
                  style={{ display: "flex", alignItems: "flex-start", padding: "10px 12px", cursor: "pointer", borderRadius: 8, position: "relative" }}
                  onClick={() => openSession(session)}
                >
                  <div style={{ marginTop: 2, marginRight: 10, color: "var(--tx-mut)" }}><MessageSquare size={15} /></div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {getSessionTitle(session)}
                    </div>
                  </div>
                  <button className="history-del-btn" onClick={(e) => { e.stopPropagation(); removeSession(session.id); }} title="Remove from notebook">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add from History */}
          <button
            onClick={() => setShowAddPanel(v => !v)}
            style={{ width: "100%", padding: "10px", background: "transparent", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 10, color: "var(--tx-mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", marginBottom: showAddPanel ? 12 : 0 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
          >
            <Plus size={15} /> Add from History
          </button>

          {showAddPanel && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {unassignedSessions.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--tx-mut)", fontSize: 12, padding: "12px 0" }}>All sessions are already assigned.</div>
              ) : (
                unassignedSessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="history-item"
                    style={{ display: "flex", alignItems: "center", padding: "9px 12px", cursor: "pointer", borderRadius: 8, opacity: 0.75 }}
                    onClick={() => assignSession(session.id)}
                  >
                    <div style={{ marginRight: 10, color: "var(--tx-mut)" }}><MessageSquare size={14} /></div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {getSessionTitle(session)}
                      </div>
                    </div>
                    <Plus size={13} color="var(--tx-mut)" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .history-item:hover { background: rgba(255,255,255,0.04); }
        .history-del-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%) scale(0.9); background: var(--bg-2); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: var(--tx-mut); cursor: pointer; padding: 5px; opacity: 0; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .history-item:hover .history-del-btn { opacity: 1; transform: translateY(-50%) scale(1); }
        .history-del-btn:hover { color: #ef4444 !important; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); }
      `}</style>
    </div>
  );
}

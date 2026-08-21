import { useState, useEffect } from "react";
import { BookOpen, Layers, Plus, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export function NotebookList({ setActiveTab }: { setActiveTab: (tab: "history" | "notebooks") => void }) {
  const [notebooks, setNotebooks] = useState<any[]>(() => {
    const saved = localStorage.getItem("customNotebooks");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("customNotebooks", JSON.stringify(notebooks));
  }, [notebooks]);

  // Listen for updates from the notebook window (e.g. rename, delete)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "customNotebooks" && e.newValue) {
        setNotebooks(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleNewNotebook = () => {
    const newNb = {
      id: Date.now(),
      title: "Untitled Notebook",
      color: "#3B82F6",
    };
    const updated = [newNb, ...notebooks];
    setNotebooks(updated);
    localStorage.setItem("customNotebooks", JSON.stringify(updated));
    // Open the new notebook immediately
    openNotebookWindow(newNb.id);
    setActiveTab("notebooks");
  };

  const handleDeleteNotebook = (e: any, id: number) => {
    e.stopPropagation();
    setNotebooks(nbs => nbs.filter(nb => nb.id !== id));
  };

  const openNotebookWindow = (id: number) => {
    // Write the target notebook ID so NotebookApp can read it on focus
    localStorage.setItem("activeNotebookId", String(id));
    // Show the pre-registered notebook panel via native Obj-C (NSPanel safe)
    invoke("show_notebook").catch(console.error);
  };

  const getNotebookChatCount = (id: number): number => {
    try {
      const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
      return sessions.filter((s: any) => s.notebookId === id).length;
    } catch {
      return 0;
    }
  };

  const renderNotebookItem = (nb: any) => {
    const chatCount = getNotebookChatCount(nb.id);
    return (
      <div
        key={nb.id}
        className="nb-item"
        onClick={() => openNotebookWindow(nb.id)}
      >
        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: nb.color, display: "flex", alignItems: "center", justifyContent: "center", marginRight: "16px", flexShrink: 0 }}>
          <BookOpen size={20} color="#fff" />
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ color: "#fff", fontSize: "14px", fontWeight: 600, marginBottom: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {nb.title}
          </div>
          <div style={{ color: "var(--tx-mut)", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{chatCount} chats</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <Layers size={10} /> {nb.attachments ?? 0}
            </span>
          </div>
        </div>
        <button
          className="history-del-btn"
          onClick={(e) => handleDeleteNotebook(e, nb.id)}
          title="Delete Notebook"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="view-pane">
      <div style={{ padding: "0 20px" }}>
        <button
          className="nb-new-btn"
          style={{ width: "100%", padding: "14px", background: "transparent", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "12px", color: "var(--tx-mut)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, marginBottom: "16px", transition: "all 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
          onClick={handleNewNotebook}
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

        {notebooks.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--tx-mut)", marginTop: "40px", fontSize: "13px" }}>
            No notebooks yet. Create one above.
          </div>
        )}
      </div>
    </div>
  );
}


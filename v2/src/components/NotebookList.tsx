import { useState, useEffect, useMemo } from "react";
import { BookOpen, Layers, Plus, Search, ChevronRight, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { syncNotebookTag } from "../utils/notebookTags";
import { useSessionsStore } from "../utils/sessionStore";

export function NotebookList({
  setActiveTab,
  onSelectNotebook,
}: {
  setActiveTab?: (tab: "history" | "notebooks") => void;
  onSelectNotebook?: (id: number) => void;
}) {
  const { sessions } = useSessionsStore();
  const [notebooks, setNotebooks] = useState<any[]>(() => {
    const saved = localStorage.getItem("customNotebooks");
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const activeNotebookId = parseInt(localStorage.getItem("activeNotebookId") || "0", 10);

  useEffect(() => {
    localStorage.setItem("customNotebooks", JSON.stringify(notebooks));
  }, [notebooks]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "customNotebooks" && e.newValue) {
        try {
          setNotebooks(JSON.parse(e.newValue));
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
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
    syncNotebookTag(newNb);

    // Open the new notebook immediately
    openNotebookWindow(newNb.id);
    if (setActiveTab) {
      setActiveTab("notebooks");
    }
  };

  const openNotebookWindow = (id: number) => {
    localStorage.setItem("activeNotebookId", String(id));
    if (onSelectNotebook) {
      onSelectNotebook(id);
    } else {
      invoke("show_notebook").catch(console.error);
    }
  };

  const chatCounts = useMemo(() => {
    const map = new Map<number, number>();
    sessions.forEach((s) => {
      const nbId = s.data?.notebookId;
      if (nbId) {
        map.set(Number(nbId), (map.get(Number(nbId)) || 0) + 1);
      }
    });
    return map;
  }, [sessions]);

  const getNotebookChatCount = (id: number): number => {
    return chatCounts.get(Number(id)) || 0;
  };

  const filteredNotebooks = useMemo(() => {
    if (!searchQuery.trim()) return notebooks;
    const q = searchQuery.toLowerCase();
    return notebooks.filter((nb) => nb.title.toLowerCase().includes(q));
  }, [notebooks, searchQuery]);

  const renderNotebookItem = (nb: any) => {
    const chatCount = getNotebookChatCount(nb.id);
    const isSelected = activeNotebookId === nb.id;

    return (
      <div
        key={nb.id}
        className={`history-item ${isSelected ? "selected-nb" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 12px",
          cursor: "pointer",
          borderRadius: "10px",
          position: "relative",
          marginBottom: "4px",
          border: isSelected
            ? `1px solid color-mix(in srgb, ${nb.color || "var(--accent)"} 50%, transparent)`
            : "1px solid rgba(255,255,255,0.04)",
          background: isSelected
            ? `color-mix(in srgb, ${nb.color || "var(--accent)"} 12%, transparent)`
            : "rgba(255,255,255,0.02)",
          transition: "all 0.15s ease",
        }}
        onClick={() => openNotebookWindow(nb.id)}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: nb.color || "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "12px",
            flexShrink: 0,
            boxShadow: `0 2px 8px color-mix(in srgb, ${nb.color || "var(--accent)"} 40%, transparent)`,
          }}
        >
          <BookOpen size={18} color="#fff" />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
          <div
            style={{
              color: "rgba(255,255,255,0.95)",
              fontSize: "14px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {nb.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "var(--tx-mut)", fontSize: "11px" }}>
              {chatCount} chat{chatCount === 1 ? "" : "s"}
            </span>
            <span
              className="tag-pill"
              style={{ "--tag-color": nb.color || "#3B82F6" } as any}
            >
              #{nb.title.toLowerCase()}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <ChevronRight size={15} color="var(--tx-mut)" style={{ opacity: 0.7 }} />
        </div>
      </div>
    );
  };

  return (
    <div className="view-pane">
      <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Search Notebooks */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
            padding: "10px 14px",
            gap: "8px",
            marginBottom: "12px",
            flexShrink: 0,
          }}
        >
          <Search size={15} color="var(--tx-mut)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search notebooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: "14px",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--tx-mut)",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* New Notebook Button */}
        <button
          className="nb-new-btn"
          style={{
            width: "100%",
            padding: "11px",
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            border: "1px dashed color-mix(in srgb, var(--accent) 40%, transparent)",
            borderRadius: "10px",
            color: "var(--accent-hi)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "12px",
            transition: "all 0.15s ease",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 20%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "color-mix(in srgb, var(--accent) 40%, transparent)";
            e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 12%, transparent)";
          }}
          onClick={handleNewNotebook}
        >
          <Plus size={15} /> New Notebook
        </button>

        {/* Info Banner */}
        <div
          style={{
            background: "rgba(124, 58, 237, 0.08)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            borderRadius: "10px",
            padding: "10px 12px",
            display: "flex",
            gap: "10px",
            alignItems: "center",
            marginBottom: "12px",
            flexShrink: 0,
          }}
        >
          <Layers size={16} color="#A78BFA" style={{ flexShrink: 0 }} />
          <span style={{ color: "#C4B5FD", fontSize: "12px", lineHeight: "1.4" }}>
            Notebooks share attachments and context across chats.
          </span>
        </div>

        {/* Notebooks List */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingBottom: "20px" }}>
          {filteredNotebooks.map((nb) => renderNotebookItem(nb))}

          {filteredNotebooks.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "var(--tx-mut)",
                marginTop: "36px",
                fontSize: "13px",
              }}
            >
              {searchQuery ? "No matching notebooks." : "No notebooks yet. Create one above."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

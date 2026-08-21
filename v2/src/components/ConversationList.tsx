import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, MessageSquare, Trash2, Plus, X, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

export interface ConversationListProps {
  sessions: any[];
  tags: any[];
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSelectSession: (session: any) => void;
  actionType?: "delete" | "add" | "remove" | "restore" | "none";
  onActionClick?: (e: React.MouseEvent, session: any) => void;
  secondaryActionType?: "delete" | "none";
  onSecondaryActionClick?: (e: React.MouseEvent, session: any) => void;
  emptyMessage?: string;
  compact?: boolean;
  showGroups?: boolean;
  activeNotebookId?: number | null;
  notebookColor?: string;
}

export function extractMessages(sessionData: any): any[] {
  if (!sessionData) return [];
  if (Array.isArray(sessionData)) return sessionData;
  if (typeof sessionData === "string") {
    try {
      const parsed = JSON.parse(sessionData);
      return extractMessages(parsed);
    } catch {
      return [];
    }
  }
  if (typeof sessionData === "object") {
    if (Array.isArray(sessionData.history)) return sessionData.history;
    if (Array.isArray(sessionData.messages)) return sessionData.messages;
    if (sessionData.data) return extractMessages(sessionData.data);
    const numericKeys = Object.keys(sessionData)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    if (numericKeys.length > 0) {
      return numericKeys.map((k) => sessionData[k]);
    }
  }
  return [];
}

export function normalizeSessionData(data: any): { history: any[]; tagId?: string | null; notebookId?: number | null; title?: string | null } {
  const history = extractMessages(data);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      ...data,
      history,
    };
  }
  return { history };
}

export function getSessionTitle(session: any): string {
  const messages = extractMessages(session.data);
  const first = messages.find((m: any) => m.role === "user")?.content || "Empty Chat";
  return session.data?.title || String(first).replace(/\n/g, " ").slice(0, 60);
}

export function getSessionTimestamp(session: any): number {
  const idStr = String(session.id);
  if (idStr.length === 13 && /^1\d{12}$/.test(idStr)) {
    return parseInt(idStr, 10);
  }
  if (session.data && session.data.updated_at) {
    const parsed = new Date(session.data.updated_at).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  if (session.ts && typeof session.ts === "number") {
    return session.ts;
  }
  return 0;
}

export function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function getRelativeDay(ts: number): string {
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

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  if (isCurrentYear) return monthNames[d.getMonth()];

  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

export function ConversationList({
  sessions,
  tags,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  showSearch = true,
  searchPlaceholder = "Search chats or tags...",
  onSelectSession,
  actionType = "delete",
  onActionClick,
  secondaryActionType = "none",
  onSecondaryActionClick,
  emptyMessage = "No conversations found.",
  compact = false,
  showGroups = true,
  notebookColor,
}: ConversationListProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchQueryChange || setInternalSearchQuery;

  const isCollapsed = (group: string) => {
    if (collapsedGroups[group] !== undefined) return collapsedGroups[group];
    return !["Today", "Yesterday", "This Week"].includes(group);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !isCollapsed(group) }));
  };

  // Filter and strictly sort sessions chronologically (newest first)
  const filteredSessions = useMemo(() => {
    const list = sessions.filter((s) => {
      const title = getSessionTitle(s);
      const tagId = s.data?.tagId || s.data?.workflowId;
      const tag = tags.find((t) => t.id === tagId);
      const tagName = tag?.name || "";

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return title.toLowerCase().includes(q) || tagName.toLowerCase().includes(q);
    });

    return list.sort((a, b) => getSessionTimestamp(b) - getSessionTimestamp(a));
  }, [sessions, tags, searchQuery]);

  // Group filtered sessions chronologically
  const { groupOrder, groupedSessions } = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredSessions.forEach((s) => {
      const ts = getSessionTimestamp(s);
      const group = getRelativeDay(ts);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push({ ...s, ts });
    });

    const groups: Record<string, any[]> = {};
    map.forEach((val, key) => {
      groups[key] = val.sort((a, b) => (b.ts || getSessionTimestamp(b)) - (a.ts || getSessionTimestamp(a)));
    });

    return {
      groupOrder: Array.from(map.keys()),
      groupedSessions: groups,
    };
  }, [filteredSessions]);

  const renderItem = (session: any) => {
    const title = getSessionTitle(session);
    const tagId = session.data?.tagId || session.data?.workflowId;
    const tag = tags.find((t) => t.id === tagId);
    const ts = session.ts !== undefined ? session.ts : getSessionTimestamp(session);

    const formattedDate = ts
      ? getRelativeDay(ts) === "Today"
        ? formatTime(ts)
        : new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" })
      : "";

    const hasDualActions = actionType !== "none" && secondaryActionType !== "none";

    return (
      <div
        key={session.id}
        className="history-item"
        style={{
          display: "flex",
          alignItems: "center",
          padding: compact ? "8px 10px" : "10px 12px",
          cursor: "pointer",
          borderRadius: 8,
          position: "relative",
          marginBottom: "2px",
          transition: "all 0.15s ease",
        }}
        onClick={() => {
          invoke("log_debug", {
            code: "INFO-CL-001",
            message: `Conversation item clicked: id=${session.id}, title=${title}`,
          }).catch(() => {});
          try {
            onSelectSession(session);
          } catch (err: any) {
            invoke("log_debug", {
              code: "ERR-CL-001",
              message: `onSelectSession threw error: ${String(err)}`,
            }).catch(() => {});
          }
        }}
      >
        <div
          style={{
            marginRight: compact ? 8 : 12,
            color: notebookColor || "var(--tx-mut)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <MessageSquare size={compact ? 14 : 16} />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
          <div
            style={{
              color: "rgba(255,255,255,0.92)",
              fontSize: compact ? "13px" : "14px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>

          {tag && (
            <div style={{ display: "inline-flex" }}>
              <div
                className="tag-pill"
                style={{ "--tag-color": tag.color || "#3B82F6" } as any}
              >
                #{tag.name.toLowerCase()}
              </div>
            </div>
          )}
        </div>

        {formattedDate && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--tx-mut)",
              marginLeft: "10px",
              marginRight: hasDualActions ? (compact ? "54px" : "64px") : actionType !== "none" ? (compact ? "24px" : "32px") : "6px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {formattedDate}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "4px", position: "absolute", right: compact ? 6 : 10 }}>
          {/* Secondary Action (e.g. Permanent Delete in Trash) */}
          {secondaryActionType === "delete" && onSecondaryActionClick && (
            <button
              className="history-del-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSecondaryActionClick(e, session);
              }}
              title="Delete Permanently"
              style={{ position: "static", opacity: 0.85, transform: "scale(1)" }}
            >
              <Trash2 size={compact ? 13 : 14} color="#ef4444" />
            </button>
          )}

          {/* Primary Action Button */}
          {actionType !== "none" && onActionClick && (
            <button
              className="history-del-btn"
              onClick={(e) => {
                e.stopPropagation();
                onActionClick(e, session);
              }}
              title={
                actionType === "delete"
                  ? "Move to Trash"
                  : actionType === "add"
                  ? "Add to Notebook"
                  : actionType === "restore"
                  ? "Restore Chat"
                  : "Remove from Notebook"
              }
              style={{
                position: "static",
                opacity: actionType === "add" || actionType === "restore" ? 0.85 : undefined,
                transform: actionType === "add" || actionType === "restore" ? "scale(1)" : undefined,
              }}
            >
              {actionType === "delete" && <Trash2 size={compact ? 13 : 14} />}
              {actionType === "add" && <Plus size={compact ? 13 : 14} color="var(--accent)" />}
              {actionType === "restore" && <RotateCcw size={compact ? 13 : 14} color="#10b981" />}
              {actionType === "remove" && <X size={compact ? 13 : 14} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, width: "100%" }}>
      {showSearch && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
            padding: compact ? "8px 10px" : "10px 14px",
            gap: "8px",
            marginBottom: "12px",
            flexShrink: 0,
          }}
        >
          <Search size={15} color="var(--tx-mut)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: compact ? "13px" : "14px",
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
      )}

      <div style={{ overflowY: "auto", flex: 1, minHeight: 0, paddingBottom: "12px" }}>
        {showGroups ? (
          <>
            {groupOrder.map((group) => {
              const groupSess = groupedSessions[group];
              if (!groupSess || groupSess.length === 0) return null;
              const collapsed = isCollapsed(group);
              return (
                <div key={group} style={{ marginBottom: collapsed ? "6px" : "14px" }}>
                  <div
                    className="group-header"
                    onClick={() => toggleGroup(group)}
                    style={{
                      cursor: "pointer",
                      userSelect: "none",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--tx-mut)",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ marginRight: "4px", display: "flex", alignItems: "center" }}>
                      {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </span>
                    {group} <span style={{ marginLeft: "6px", opacity: 0.6 }}>{groupSess.length}</span>
                    <div
                      style={{
                        flex: 1,
                        height: "1px",
                        background: "rgba(255,255,255,0.05)",
                        marginLeft: "10px",
                      }}
                    />
                  </div>
                  {!collapsed && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {groupSess.map((s) => renderItem(s))}
                    </div>
                  )}
                </div>
              );
            })}
            {groupOrder.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--tx-mut)",
                  marginTop: "32px",
                  fontSize: "13px",
                }}
              >
                {emptyMessage}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredSessions.map((s) => renderItem(s))}
            {filteredSessions.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--tx-mut)",
                  marginTop: "24px",
                  fontSize: "13px",
                }}
              >
                {emptyMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { getSessionTimestamp } from "../components/ConversationList";

export interface SessionItem {
  id: string;
  data: any;
  ts?: number;
}

let cachedSessions: SessionItem[] | null = null;
let cachedTrash: SessionItem[] | null = null;
let isFetchingSessions = false;
let isFetchingTrash = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function getCachedSessions(): SessionItem[] {
  return cachedSessions || [];
}

export function getCachedTrash(): SessionItem[] {
  return cachedTrash || [];
}

export async function fetchSessions(force = false): Promise<SessionItem[]> {
  if (cachedSessions && !force) {
    return cachedSessions;
  }
  if (isFetchingSessions) return cachedSessions || [];

  isFetchingSessions = true;
  try {
    const raw: any = await invoke("load_sessions");
    const items = (raw || []).map((s: any) => ({
      ...s,
      ts: getSessionTimestamp(s),
    }));
    items.sort((a: any, b: any) => b.ts - a.ts);
    cachedSessions = items;
    notifyListeners();
    return items;
  } catch (err) {
    console.error("Failed to load sessions:", err);
    return cachedSessions || [];
  } finally {
    isFetchingSessions = false;
  }
}

export async function fetchTrash(force = false): Promise<SessionItem[]> {
  if (cachedTrash && !force) {
    return cachedTrash;
  }
  if (isFetchingTrash) return cachedTrash || [];

  isFetchingTrash = true;
  try {
    const raw: any = await invoke("load_trash");
    const items = (raw || []).map((s: any) => ({
      ...s,
      ts: getSessionTimestamp(s),
    }));
    items.sort((a: any, b: any) => b.ts - a.ts);
    cachedTrash = items;
    notifyListeners();
    return items;
  } catch (err) {
    console.error("Failed to load trash:", err);
    return cachedTrash || [];
  } finally {
    isFetchingTrash = false;
  }
}

export async function deleteSessionToTrash(id: string): Promise<void> {
  const current = cachedSessions || [];
  const item = current.find((s) => String(s.id) === String(id));
  
  // Optimistic update
  cachedSessions = current.filter((s) => String(s.id) !== String(id));
  if (item) {
    cachedTrash = [item, ...(cachedTrash || [])];
  }
  notifyListeners();

  try {
    await invoke("delete_session", { sessionId: id });
  } catch (err) {
    console.error("Failed to delete session:", err);
    fetchSessions(true);
    fetchTrash(true);
  }
}

export async function restoreSessionFromTrash(id: string): Promise<void> {
  const currentTrash = cachedTrash || [];
  const item = currentTrash.find((s) => String(s.id) === String(id));

  // Optimistic update
  cachedTrash = currentTrash.filter((s) => String(s.id) !== String(id));
  if (item) {
    cachedSessions = [item, ...(cachedSessions || [])].sort(
      (a, b) => getSessionTimestamp(b) - getSessionTimestamp(a)
    );
  }
  notifyListeners();

  try {
    await invoke("restore_session", { sessionId: id });
    await emit("history-sync", null);
  } catch (err) {
    console.error("Failed to restore session:", err);
    fetchSessions(true);
    fetchTrash(true);
  }
}

export async function updateSessionData(id: string, data: any): Promise<void> {
  const current = cachedSessions || [];
  cachedSessions = current.map((s) =>
    String(s.id) === String(id) ? { ...s, data } : s
  );
  notifyListeners();

  try {
    await invoke("save_session", { sessionId: String(id), data });
    await emit("history-sync", null);
  } catch (err) {
    console.error("Failed to update session data:", err);
    fetchSessions(true);
  }
}

export async function permanentlyDeleteSession(id: string): Promise<void> {
  cachedTrash = (cachedTrash || []).filter((s) => String(s.id) !== String(id));
  notifyListeners();

  try {
    await invoke("permanently_delete_session", { sessionId: id });
  } catch (err) {
    console.error("Failed to permanently delete session:", err);
    fetchTrash(true);
  }
}

export async function emptyAllTrash(): Promise<void> {
  cachedTrash = [];
  notifyListeners();

  try {
    await invoke("empty_trash");
  } catch (err) {
    console.error("Failed to empty trash:", err);
    fetchTrash(true);
  }
}

// Global listener for sync events across windows/surfaces
let isSyncListenerInitialized = false;
let syncDebounceTimer: any = null;

export function initGlobalSyncListener() {
  if (isSyncListenerInitialized) return;
  isSyncListenerInitialized = true;

  listen("history-sync", () => {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      fetchSessions(true);
      fetchTrash(true);
    }, 150);
  });
}

// React Hook for consuming cached sessions
export function useSessionsStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    initGlobalSyncListener();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);

    // Initial fetch if cache is empty
    if (cachedSessions === null) {
      fetchSessions();
    }
    if (cachedTrash === null) {
      fetchTrash();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(() => {
    fetchSessions(true);
    fetchTrash(true);
  }, []);

  return {
    sessions: cachedSessions || [],
    trashSessions: cachedTrash || [],
    refresh,
    updateSessionData,
    deleteSessionToTrash,
    restoreSessionFromTrash,
    permanentlyDeleteSession,
    emptyAllTrash,
  };
}

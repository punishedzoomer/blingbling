# Performance Audit Watchlist

Static review of potential bottlenecks across the codebase. Use as an investigation guide for future optimizations.

---

## 1. Heavy Bundled Dependencies & Rendering

### 1.1 `react-syntax-highlighter` + `Prism`
- **Location:** `v2/src/components/MarkdownRenderer.tsx:5`
- **Impact:** Pulls full Prism language set into bundle (~1.27 MB vendor chunk). Parses ASTs on main thread per code block on each render.
- **Action:** Switch to `prism-light` with explicit language whitelist, or use lightweight token highlighter. Memoize code blocks.

### 1.2 KaTeX Font Bloat
- **Location:** `v2/src/App.css`, `dist/assets/`
- **Impact:** Ships 30+ font files (`.ttf`, `.woff`, `.woff2`) across all weights, loaded across multiple WebViews.
- **Action:** Strip unused font variants via Vite asset filtering or configure minimal subset.

### 1.3 Unmemoized Markdown Pipeline
- **Location:** `v2/src/components/MarkdownRenderer.tsx:1-4`
- **Impact:** Entire unified pipeline (remark-gfm -> remark-math -> rehype-katex) re-runs per message on every render.
- **Action:** Wrap `MessageRenderer` in `React.memo` keyed by message content hash.

---

## 2. Streaming & Re-render Cascades

### 2.1 Full Message Array Mutation on Stream Chunks
- **Location:** `v2/src/App.tsx:240-260`
- **Impact:** Every SSE token updates top-level state, triggering full `MessageList` re-render during active streaming.
- **Action:** Isolate active streaming chunk in a dedicated sub-component buffer; commit to `messages` only on `[DONE]`.

### 2.2 Forced Layout Thrashing on Scroll
- **Location:** `v2/src/components/MessageList.tsx:51-60`
- **Impact:** `useLayoutEffect` reads `scrollHeight` and schedules `requestAnimationFrame` on every streamed token.
- **Action:** Throttle autoscroll to single rAF loop checking a bottom-stick flag instead of layout-effect dependency triggers.

### 2.3 Monolithic Composer Re-renders
- **Location:** `v2/src/App.tsx`, `v2/src/components/InputArea.tsx`
- **Impact:** Typing or tag toggles re-render `App`, `ComposerBottom`, and `MessageList`.
- **Action:** Split state into focused contexts/hooks; memoize `InputArea` and `ComposerBottom` with `React.memo`.

---

## 3. Data Flow, Storage & IPC

### 3.1 Base64 Images in Session Storage
- **Location:** `v2/src/hooks/useAttachments.ts`, `v2/src-tauri/src/commands/session.rs:31`
- **Impact:** Full-resolution screenshot base64 strings persist directly in session JSON files, causing multi-megabyte payloads.
- **Action:** Store binary images to disk (`app_data_dir/assets/`) and reference paths in session JSON.

### 3.2 Main-Thread PDF Parsing
- **Location:** `v2/src/utils/fileProcessor.ts:33-146`
- **Impact:** Synchronous stream decompression and string parsing run on WebView JS thread during drag/drop.
- **Action:** Delegate PDF text extraction to a Rust Tauri command (`lopdf` / `pdf-extract`).

### 3.3 Synchronous Session Directory Scans
- **Location:** `v2/src-tauri/src/commands/session.rs:39-61`
- **Impact:** `load_sessions` synchronously reads and parses every JSON file on the main thread when History opens.
- **Action:** Implement a lightweight `index.json` sidecar for metadata; load full session conversation history on demand.

### 3.4 Broadcast IPC Fan-out
- **Location:** `v2/src/App.tsx`, `v2/src/HistoryApp.tsx`, `v2/src/NotebookApp.tsx`
- **Impact:** `emit("history-sync")` and `storage` events trigger full re-fetches and JSON re-parses across all open windows.
- **Action:** Send granular delta payloads (e.g. `{ action: "tag_updated", id }`) and debounce cross-window listeners.

---

## 4. Multi-Window & Native Overhead

### 4.1 Frequent Panel Resize IPC
- **Location:** `v2/src/useDynamicBounds.ts:12-30`
- **Impact:** `ResizeObserver` fires `resize_panel` IPC and Cocoa `setFrame:` calls on every DOM height shift.
- **Action:** Throttle via `requestAnimationFrame` and observe only the dynamic sub-container rather than `document.body`.

### 4.2 Multi-WebView Memory Overhead
- **Location:** `v2/src-tauri/tauri.conf.json`
- **Impact:** Six concurrent WebViews (`main`, `history`, `notebook`, `settings`, `tutorial`, `snip`) load bundle instances simultaneously.
- **Action:** Transition to unified window architecture (`Docs/full_windowed_mode.md`) or lazily instantiate auxiliary WebViews.

### 4.3 Missing List Virtualization
- **Location:** `v2/src/components/MessageList.tsx`, `v2/src/components/ConversationList.tsx`
- **Impact:** Long chat histories (100+ messages) and large session lists mount complete DOM trees with full markdown.
- **Action:** Virtualize message and conversation lists using `@tanstack/react-virtual`.

---

## 5. Priority Action Matrix

| Priority | Task | Target File |
|---|---|---|
| High | Memoize markdown rendering per message | `v2/src/components/MarkdownRenderer.tsx` |
| High | Separate streaming buffer from message history | `v2/src/App.tsx` |
| High | Throttle dynamic panel resize IPC | `v2/src/useDynamicBounds.ts` |
| Medium | Store attachment images on disk instead of JSON | `v2/src/hooks/useAttachments.ts` |
| Medium | Replace full Prism table with `prism-light` | `v2/src/components/MarkdownRenderer.tsx` |
| Medium | Metadata sidecar index for session history | `v2/src-tauri/src/commands/session.rs` |
| Medium | Move PDF extraction to Rust backend | `v2/src/utils/fileProcessor.ts` |
| Low | Virtualize message and session lists | `v2/src/components/MessageList.tsx` |
| Low | Strip unused KaTeX font variants | `v2/src/App.css` |

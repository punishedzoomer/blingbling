# Performance Audit — Current Features That May Be Hindering Performance

A non-exhaustive review of the existing app, written so you can decide what to
investigate next. **Nothing here is fixed or even confirmed as a bottleneck**;
each item lists the suspected cost, the evidence (file + line range) and a
suggested direction you can explore. Use this as a watchlist, not a punch
list.

---

## 1. Heavy Bundled Dependencies

### 1.1 `react-syntax-highlighter` + `Prism`
- **Where**: `v2/src/components/MarkdownRenderer.tsx:5`
  ```ts
  import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
  import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
  ```
- **Suspected cost**:
  - `react-syntax-highlighter` pulls in Prism's full language table by
    default. Even with the `light` build it is typically ~1 MB of JS.
  - `Prism` constructs syntax trees on the main thread for every code block
    on every render. A long code-heavy assistant reply can take noticeable
    time to mount and re-render.
  - The production bundle reported by Vite shows `vendor-*.js` at
    `1.27 MB` (gzipped `417 kB`). The syntax highlighter is one of the
    largest single contributors.
- **Where it hurts most**: long AI responses with multiple code blocks,
  history views, and `restore-session` of a large conversation.
- **Improvement directions**:
  - Switch to `react-syntax-highlighter/dist/esm/prism-light` plus an
    explicit `registerLanguage` whitelist.
  - Replace with `shiki` (lazy/highlight-once), `prismjs` directly with a
    tiny language set, or a hand-rolled token highlighter for the few
    languages you actually emit.
  - Memoize syntax-highlighted blocks so they don't re-highlight when the
    message list re-renders.

### 1.2 KaTeX fonts (full set)
- **Where**: `v2/src/App.css` and the Vite build output (the build
  report shows every KaTeX font being shipped in `dist/assets/`: `.ttf`,
  `.woff`, `.woff2` for many weights, including 30+ files).
- **Suspected cost**:
  - Network/disk payload on first load.
  - Memory pressure: Tauri loads the WebView once per window, but each
    font subset still consumes memory.
- **Where it hurts most**: cold start, especially over a slow connection;
  cumulative when you have multiple NSPanels open.
- **Improvement directions**:
  - Ship only the KaTeX weights/sizes you actually style (typically
    Regular/Bold for Main, Math, and AMS at one or two sizes).
  - Configure Vite to drop unused font files in
    `vite.config.ts` `build.assetsInlineLimit` / a manual cleanup step.
  - Use system math fonts as a fallback where possible.

### 1.3 `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`
- **Where**: `v2/src/components/MarkdownRenderer.tsx:1-4`
- **Suspected cost**: every assistant message is parsed by the full
  unified pipeline (remark -> rehype -> katex) on every render. There is
  no memoization at the message level.
- **Improvement directions**:
  - Wrap each `MessageRenderer` in `React.memo` keyed by message content
    hash so unchanged messages don't re-parse.
  - Stream the markdown incrementally only after the LLM response is
    complete; do not re-parse the entire growing message on each token
    (see #2.1).

---

## 2. Streaming & Re-render Patterns

### 2.1 Whole-message state updates on every streamed token
- **Where**: `v2/src/App.tsx` `handleSend` writes the assistant message
  to state on each `stream_ai_response` chunk. Every update replaces the
  full `messages` array.
- **Suspected cost**:
  - Each chunk triggers a full re-render of `MessageList`
    (`v2/src/components/MessageList.tsx`), which iterates the full
    message array and re-mounts KaTeX/Prism trees for any previously
    rendered messages.
  - Long responses feel sluggish because the bottleneck is not the
    network, but the render cost per token.
- **Improvement directions**:
  - Maintain a separate "streaming buffer" state, then promote to a
    permanent `Message` only on `done`.
  - Use `useDeferredValue` on the streaming content so the input area
    stays responsive while the markdown catches up.
  - Move markdown rendering behind `React.memo` per message id so only
    the actively streaming message re-renders.

### 2.2 `useLayoutEffect` scroll snap on every message change
- **Where**: `v2/src/components/MessageList.tsx:51-60`
  ```ts
  useLayoutEffect(() => {
    ...
    requestAnimationFrame(() => { ... });
  }, [messages, isThinking]);
  ```
- **Suspected cost**: fires on every `messages` update (i.e. every
  streamed token), reads `getBoundingClientRect`, schedules an rAF, and
  forces layout twice.
- **Improvement directions**:
  - Move the auto-scroll to a single per-frame `requestAnimationFrame`
    loop that reads a "should follow" flag rather than
    `useLayoutEffect` on a fast-changing dependency.
  - Use `IntersectionObserver` / `ResizeObserver` on the bottom sentinel
    to scroll only when the user is near the bottom.

### 2.3 Re-rendering the entire composer tree on tag changes
- **Where**: `v2/src/App.tsx` keeps `activeTagId`, `tags`, `activeNotebookId`
  in the top-level component and threads them down to `InputArea`,
  `ComposerBottom`, and the active-tag bar.
- **Suspected cost**: typing in the textarea, switching tags, or
  toggling the attachments tray re-renders the entire `App` subtree.
- **Improvement directions**:
  - Split state into a reducer or context (`ComposerState`,
    `TagState`, `NotebookState`) so unrelated updates don't cascade.
  - Memoize `InputArea` and `ComposerBottom` with `React.memo`.
  - Move `activeTag` derivation to a `useMemo` (or selector) so the
    tag bar doesn't re-render when unrelated state changes.

---

## 3. Image / Attachment Handling

### 3.1 Base64 in `localStorage` and JSON session files
- **Where**: `useAttachments.ts:132-173` and `MessageList.tsx:60-...`
  build the LLM payload with raw base64 image data; the conversation
  is then persisted via `save_session`
  (`v2/src-tauri/src/commands/session.rs:31`).
- **Suspected cost**:
  - Each PNG screenshot can be hundreds of KB. A 10-screenshot
    conversation stored in JSON is several MB of UTF-8.
  - `load_sessions` (`session.rs:39`) reads every JSON file in the
    sessions directory and parses it eagerly on every open of the
    history window.
  - `localStorage.setItem("customTags", ...)` plus
    `storage` events broadcast the entire serialized state on each
    change.
- **Improvement directions**:
  - Save attachments to a separate binary store (e.g.
    `~/Library/Application Support/BlingBling/assets/<id>.png`) and
    keep only a reference in the session JSON.
  - Lazy-load images in `MessageList` using `IntersectionObserver`
    and a placeholder.
  - Stream large payloads to the LLM in `stream_ai_response` instead
    of embedding the full image array in the IPC payload.

### 3.2 PDF text extraction on the WebView main thread
- **Where**: `v2/src/utils/fileProcessor.ts:33-146` (`extractPdfText` /
  `parsePdfTextOperators`)
- **Suspected cost**:
  - Runs synchronously inside `processFile`, which is awaited inside
    the React drop/paste handlers.
  - Multiple large PDFs can block the UI thread, freezing the
    composer.
- **Improvement directions**:
  - Move PDF extraction to the Rust side (Tauri command
    `extract_pdf_text`) so it runs off the WebView thread and can
    take advantage of `lopdf` or a real PDF crate.
  - For very large PDFs, show a progress indicator and chunk the
    extraction.

### 3.3 `useAttachments` returns a large object on every render
- **Where**: `v2/src/hooks/useAttachments.ts:177-204`
- **Suspected cost**: even though the setters are stable, the
  returned object identity changes every render, which forces
  downstream components (`App.tsx`, `ComposerBottom`,
  `AttachmentsTray`) to invalidate memoization.
- **Improvement directions**:
  - Wrap the returned object in `useMemo` keyed on the actual
    underlying state slices.
  - Or split into smaller hooks: `useAttachmentTray`,
    `useDragAndDrop`, `useClipboardPaste`.

---

## 4. State Synchronization & IPC

### 4.1 `storage` event fan-out
- **Where**: `App.tsx`, `HistoryApp.tsx`, `NotebookApp.tsx` all listen
  to `window.addEventListener("storage", ...)` and re-parse the same
  payloads.
- **Suspected cost**: each window does its own JSON parse on every
  storage mutation. The mutation rate is high (every tag edit, every
  workflow change, every selection).
- **Improvement directions**:
  - Throttle / debounce the listener.
  - Move "current snapshot" into a single Tauri-managed store
    exposed via commands rather than `localStorage`.

### 4.2 `load_sessions` reads every JSON file synchronously
- **Where**: `v2/src-tauri/src/commands/session.rs:39-61`
- **Suspected cost**:
  - Single-threaded blocking read of the entire session directory
    every time the history window opens.
  - Each session is fully parsed into `serde_json::Value` even if the
    UI only needs the title and last-modified time.
- **Improvement directions**:
  - Maintain a sidecar index (`index.json`) with `{id, title,
    updated_at, tagId, notebookId}` and load the index first, lazy-
    loading full session bodies on demand.
  - Parallelize the `fs::read_to_string` calls with `rayon` or
    `tokio::fs`.

### 4.3 `emit("history-sync", null)` for every state change
- **Where**: `App.tsx`, `InputArea.tsx`, `NotebookApp.tsx` etc.
- **Suspected cost**: an IPC fan-out for every tag create/remove,
  every selection, every notebook rename. If the history window is
  open it re-fetches the full session list each time.
- **Improvement directions**:
  - Switch from "tell everyone to re-fetch" to "publish a delta".
    e.g. `history-sync { kind: "tag-changed", id, name, color }`.
  - Coalesce multiple updates inside a single rAF/tick.

---

## 5. Window / NSPanel Costs

### 5.1 `useDynamicBounds` issues a `resize_panel` IPC on every layout change
- **Where**: `v2/src/useDynamicBounds.ts:12-30`
- **Suspected cost**:
  - `ResizeObserver` fires for any DOM mutation that changes
    `body`'s bounding rect. This includes toggling the tag bar
    (`#composer margin-bottom`/`active-tag-bar` show/hide), opening
    the attachments tray, streaming a new message, etc.
  - Each call schedules an `invoke("resize_panel", ...)` round-trip
    plus an `objc::msg_send![setFrame:...]` on the main thread.
  - During streaming, this can fire dozens of times per second.
- **Improvement directions**:
  - Use a `requestAnimationFrame` throttle (one resize per frame at
    most) instead of `setTimeout(..., 10)`.
  - Only observe the composer subtree, not the entire `<body>`.
  - Skip resizing when the window is in windowed mode (the
    `app-shell` has native resize).

### 5.2 Each NSPanel is its own WebView
- **Where**: `v2/src-tauri/tauri.conf.json` (six windows:
  `main`, `history`, `notebook`, `settings`, `tutorial`, `snip`).
- **Suspected cost**:
  - Each WebView loads its own copy of the Vite bundle
    (`vendor-*.js` ~1.27 MB) plus the framework runtime.
  - Total memory footprint scales with the number of windows
    currently shown (`orderFront`) and even hidden panels can
    retain webview state.
  - When the user clicks between tabs (e.g. open History, then
    Notebook, then Settings) you can end up with three live
    webviews competing for CPU.
- **Improvement directions**:
  - This is the main motivation behind the planned **Full Windowed
    Mode** (`Docs/full_windowed_mode.md`) — collapsing to a single
    `app-shell` webview.
  - Until that's done, consider a "lazy-mount" approach: keep
    `visible: false` for unused windows and only build the React
    tree on first focus.

### 5.3 `set_collection_behaviour` and `set_level` re-applied to every window on every setup
- **Where**: `v2/src-tauri/src/lib.rs:66-93`
- **Suspected cost**: minor, but every new window pays the
  `to_panel()` swizzling cost. With six windows this is six
  objc swizzles and `setStyleMask` mutations at startup.
- **Improvement directions**: factor into a helper, no behavior
  change required.

---

## 6. CSS / Rendering Costs

### 6.1 `backdrop-filter: blur(...)` over the entire floating panel
- **Where**: `v2/src/App.css` — `.glass`, `#panel`, and many
  component classes use `backdrop-filter`.
- **Suspected cost**: macOS has to re-blur the live desktop under
  the panel on every frame the panel repaints. Combined with
  streaming updates and the dynamic resizing described in #5.1,
  this can keep the GPU busy.
- **Improvement directions**:
  - When in windowed mode, drop the blur or reduce the radius.
  - Use a static gradient / image background instead of live
    blurring in the area outside the conversation list.

### 6.2 Re-rendering inline styles
- **Where**: many components use `style={{ ... }}` literals (e.g.
  the active-tag chip, the attachments tray, the conversation
  rows). Each render creates a new style object.
- **Improvement directions**:
  - Move to CSS variables driven by a small set of class names.
  - Use `React.memo` for rows in long lists.

### 6.3 No virtualization in `MessageList` or `ConversationList`
- **Where**: `v2/src/components/MessageList.tsx`,
  `v2/src/components/ConversationList.tsx`
- **Suspected cost**: a 200-message conversation or a 500-entry
  history list renders all DOM nodes at once. Each message contains
  a full markdown tree.
- **Improvement directions**:
  - Use `react-window` or `@tanstack/react-virtual` for both the
    message list and the history list.
  - Render placeholders for off-screen messages until they scroll
    into view.

---

## 7. JavaScript-level Smells

### 7.1 Recomputing `getSessionTimestamp` / `getSessionTitle` per item
- **Where**: `v2/src/components/ConversationList.tsx:60-79` and the
  inline sort in `HistoryApp.tsx:35-43`.
- **Suspected cost**: the sort runs on every list re-render and
  walks every session's id, `data.updated_at`, and `ts`.
- **Improvement directions**:
  - `useMemo` the sorted + filtered list keyed on `[sessions,
    searchQuery, activeTab]`.
  - Pre-compute a normalized session object once when the list is
    loaded.

### 7.2 Synchronous JSON parsing on every storage update
- **Where**: `App.tsx:90-100`, `HistoryApp.tsx:23-31`,
  `NotebookApp.tsx` similar pattern.
- **Improvement directions**: debounce, or use a single
  `useSyncExternalStore` against `localStorage` that caches the
  parsed value.

### 7.3 `confirm("…")` for native dialog fallbacks
- **Where**: e.g. `Toolbar.tsx:27` falls back to `alert(...)` if
  `show_panel` fails.
- **Suspected cost**: negligible, but worth noting that
  blocking `alert`/`confirm` calls on the WebView main thread will
  freeze streaming and animations.

---

## 8. Network & Extension

### 8.1 The browser extension opens a `WebSocket` to the desktop app
- **Where**: `v2/src-tauri/src/websocket.rs` and the extension's
  `content.js`.
- **Suspected cost**: long-lived sockets and a global
  `extensionCompanion` status flag mean the desktop app must keep
  the listener open even when no browser is connected.
- **Improvement directions**:
  - Add an idle timeout.
  - Compress large payloads (snips) over the wire.

### 8.2 LLM streaming payload re-built on every keystroke when typing a `/tag` command
- **Where**: `v2/src/components/InputArea.tsx:60-80` (when the
  typing pattern matches `/tag ...`, the handler mutates state
  even if the user is mid-typing).
- **Improvement directions**: debounce the inline tag detection
  by a frame; the regex is fine, but the `setInput` call inside
  `handleInputChange` is a `setState` that can interact poorly with
  IME composition on macOS.

---

## 9. Quick-Win Watchlist

A short list of items that, if addressed, are likely to give a
perceptible improvement at low risk:

1. **Memoize `MessageRenderer`** per message id
   (`v2/src/components/MarkdownRenderer.tsx`).
2. **Throttle `useDynamicBounds`** to one resize per rAF
   (`v2/src/useDynamicBounds.ts`).
3. **Lazy-load Prism** languages or switch to `prismjs` with a
   small whitelist (`v2/src/components/MarkdownRenderer.tsx:5`).
4. **Add a session index** so `load_sessions` is O(1) metadata
   fetch plus O(1) full-body fetch on demand
   (`v2/src-tauri/src/commands/session.rs:39`).
5. **Move PDF extraction to Rust** to free the WebView main thread
   (`v2/src/utils/fileProcessor.ts:33`).
6. **Store attachments out-of-band** so session JSON stays small
   (`v2/src/hooks/useAttachments.ts`).
7. **Virtualize long lists** in `MessageList` and
   `ConversationList`.
8. **Drop unused KaTeX fonts** from the bundle.
9. **Skip `setFrame` on `app-shell`** (windowed mode) and let the
   native window manage its own size.
10. **Coalesce `history-sync` events** instead of broadcasting a
    full re-fetch hint.

---

## 10. Methodology Notes

- This is a static review of the current code, not a profiled
  measurement. Each section above is a hypothesis worth
  investigating with `cargo build --release`, WebKit's "Timings"
  inspector, or Tauri's `webview.show-devtools` profiling before
  committing to a fix.
- Bundle sizes quoted above are from the most recent Vite build
  output (`dist/assets/vendor-*.js` at ~1.27 MB). Re-run `npm run
  build` in `v2/` to confirm they still apply.
- No code changes were made while writing this document. All
  `file:line` references are starting points; the surrounding
  context may have shifted.

# Bugfixes and Architecture Log

## Architecture Context & Bug Log

### 2026-08-21: Unified open_main_chat Command for Window Transitions
- **Feature/Fix**: Added a dedicated `open_main_chat` command in the Rust backend to handle window transitions when opening conversations from secondary panels.
- **Root Cause & Rationale**: Calling multiple asynchronous window hide/show commands across separate webviews created race conditions where the main panel was not raised or focused.
- **Exact Fix**:
  - Implemented `commands::window::open_main_chat` in Rust to cleanly dismiss all auxiliary windows (`history`, `notebook`, `settings`, `snip`), set `main` alpha to 1.0, and bring `main` to the front with focus in a single atomic main-thread invocation.
  - Updated `NotebookApp.tsx` and `HistoryApp.tsx` to invoke `open_main_chat` when selecting any conversation.

### 2026-08-21: Instant Bottom Placement & String-Safe Session Restores
- **Feature/Fix**: Replaced animated smooth scrolling with instant pre-layout bottom placement, and made session ID lookups string-safe across notebook additions and restores.
- **Root Cause & Rationale**: Animated smooth scrolling was disruptive when opening past chats, and strict equality comparison between numeric session IDs and string identifiers caused session lookup mismatches.
- **Exact Fix**:
  - Implemented `useLayoutEffect` in `MessageList.tsx` to position `containerRef.current.scrollTop = containerRef.current.scrollHeight` synchronously before browser paint, eliminating all scroll animation and positioning the user instantly at the bottom.
  - Normalized all session ID comparisons in `NotebookApp.tsx` using `String(a) === String(b)`.
  - Streamlined `openSession` to dismiss secondary panels and smoothly focus the main window.

### 2026-08-21: Reusable Minimal ConfirmModal & Trash Bin System
- **Feature/Fix**: Added a lightweight, reusable `ConfirmModal.tsx` and implemented a complete filesystem-backed Trash Bin for deleted conversations with instant restore and permanent purge capabilities.
- **Root Cause & Rationale**: Permanent chat deletion was too easy to trigger accidentally with no way to recover lost conversations, and confirmation dialogs needed a unified, non-intrusive design.
- **Exact Fix**:
  - Implemented `ConfirmModal.tsx` with clean glassmorphic styling, danger highlighting, and escape/enter keyboard handling.
  - Added Rust backend commands in `session.rs` (`load_trash`, `restore_session`, `permanently_delete_session`, `empty_trash`) providing true soft-delete functionality.
  - Added a third "Trash" tab to the segmented control in `HistoryApp.tsx` displaying trashed conversations with single-click restore (`RotateCcw`), permanent deletion, and empty trash confirmation.

### 2026-08-21: Notebook Safe Deletion & Confirmation Modal
- **Feature/Fix**: Removed the quick delete button from the notebook list view and added a confirmation modal inside `NotebookApp.tsx` before deletion.
- **Root Cause & Rationale**: Notebooks hold valuable conversations and assets, so quick deletion from the list view risks accidental loss.
- **Exact Fix**:
  - Removed the `Trash2` button from `NotebookList.tsx`.
  - Added a glassmorphic confirmation modal dialog inside `NotebookApp.tsx` prompting the user before deleting a notebook.

### 2026-08-21: Chronological Ordering, Notebook Conflict Prevention & List Highlighting
- **Feature/Fix**: Ensured strict descending chronological order for "Add from History" notes, eliminated duplicate notebook additions with automatic tag assignment, and redesigned the notebook list in the history window to match design language.
- **Root Cause & Rationale**: Conversations in the drawer lacked explicit chronological sorting, duplicate adds were possible without notebook ID exclusion, and `NotebookList.tsx` lacked active/hover highlight states and search functionality.
- **Exact Fix**:
  - Enforced descending timestamp sorting in `ConversationList.tsx` and `NotebookApp.tsx`.
  - Excluded any already-assigned conversation from the "Add from History" drawer and added duplication guards.
  - Automatically verified and synced notebook tags for all conversations assigned to a notebook.
  - Redesigned `NotebookList.tsx` with search filtering, active selection borders/glowing background, tag pills, and consistent item styling.

### 2026-08-21: Notebook Window Dismissal & History Return Fix
- **Feature/Fix**: Fixed closing the notebook window unintentionally triggering a new chat and opening the main panel over the history window.
- **Root Cause & Rationale**: `hide_notebook` in `window.rs` was calling `show_panel("main")`, which raised the main chat window and obscured the open history/notebooks list.
- **Exact Fix**:
  - Removed `show_panel("main")` from `hide_notebook` so hiding the notebook simply dismisses its panel.
  - Updated `handleDone` and `handleDelete` in `NotebookApp.tsx` to explicitly restore and focus `show_panel("history")`, taking the user straight back to the Notebooks list tab.
  - Maintained `show_panel("main")` exclusively for when the user clicks `New Chat` or opens a specific conversation.

### 2026-08-21: Pluggable ConversationList Component Extraction
- **Feature/Fix**: Extracted a unified, modular `ConversationList.tsx` component shared across `HistoryApp.tsx` and `NotebookApp.tsx`.
- **Root Cause & Rationale**: The notebook window lacked date grouping, formatted timestamps, and real-time search filtering, while duplicating session list logic.
- **Exact Fix**:
  - Implemented `v2/src/components/ConversationList.tsx` supporting date grouping ("Today", "Yesterday", "This Week", etc.), time formatting, search filtering, tag pills, collapsible groups, and custom action buttons (Delete, Add, Remove).
  - Refactored `HistoryApp.tsx` and `NotebookApp.tsx` (both notebook conversation list and history picker drawer) to use `ConversationList`.

### 2026-08-21: Tab Indentation & Unindent Support in Prompt Box
- **Feature/Fix**: Supported Tab and Shift+Tab key indentation (4 spaces) in the chat composer input textarea.
- **Root Cause & Rationale**: By default, WebKit intercepts the Tab key in textareas and shifts focus away to UI buttons instead of inserting indentation spaces.
- **Exact Fix**: Added custom `onKeyDown` interception for `Tab` (inserting 4 spaces at cursor position or multi-line block indentation) and `Shift+Tab` (removing up to 4 spaces of leading indentation) in `v2/src/components/InputArea.tsx`.

### 2026-08-21: Notebook Auto-Tagging & Dual Action Bar Layout
- **Feature/Fix**: Added seamless auto-tagging for notebook conversations and an integrated dual action bar in `NotebookApp.tsx`.
- **Root Cause & Rationale**: Users needed to both start fresh conversations inside a notebook and easily add existing conversations from history, while ensuring all notebook conversations automatically inherit the notebook's title and color as a tag in the history panel.
- **Exact Fix**:
  - Implemented `v2/src/utils/notebookTags.ts` to automatically synchronize notebook titles and colors into `customTags`.
  - Replaced the bottom button in `NotebookApp.tsx` with a dual action bar right beneath the header:
    - **`+ New Chat`**: Starts a new conversation pre-bound to the notebook and pre-tagged with the notebook's tag.
    - **`Add from History`**: Toggles an accordion drawer to assign existing chats to the notebook.
  - Renaming or deleting notebooks automatically updates or unbinds the corresponding tags.
  - Updated `NotebookList.tsx` and `App.tsx` to preserve `notebookId` and display real-time chat counts.

### 2026-08-21: Cross-Window Tag Synchronization in History Panel
- **Feature/Fix**: Fixed tag pills not rendering under conversation titles in the History window.
- **Root Cause & Rationale**: `HistoryApp.tsx` initialized `tags` in a static `useState` hook on window mount without dynamic `setTags` updates. When new tags were created in the main chat window or settings, the history window retained a stale tag cache and failed to resolve `tagId`. Furthermore, `App.tsx` and `HistoryApp.tsx` were checking legacy `customWorkflows` instead of `customTags`.
- **Exact Fix**:
  - Added dynamic `tags` reloading in `HistoryApp.tsx` on `loadSessions()`, `history-sync`, window `focus`, and `storage` events.
  - Updated `filteredSessions` and `renderHistoryItem` to look up by `tagId` (with fallback to legacy `workflowId`).
  - Fixed storage event listeners across windows to synchronize `customTags`.

### 2026-08-21: Rich Attachments & Clipboard Imports Support
- **Feature/Fix**: Added modular rich attachments system with support for images, PDFs, code files, and Markdown notes, including background window hiding during file picking.
- **Root Cause & Rationale**: Floating NSPanels with high window level (level 1000) stay in front across all spaces and obscure the macOS file open dialog.
- **Exact Fix**:
  - Implemented `commands::file::pick_files` in Rust backend that calls `hide_panel("main")` before presenting the native macOS file chooser and `show_panel("main")` immediately upon completion or cancellation.
  - Implemented `v2/src/utils/fileProcessor.ts` for file parsing, Base64 encoding of images, and native PDF text stream decoding.
  - Implemented `v2/src/hooks/useAttachments.ts` custom hook to encapsulate all drag-and-drop, clipboard paste, file selection, and payload assembly logic.
  - Created modular UI components: `AttachmentsTray.tsx`, `DropZoneOverlay.tsx`, and `ImagePreviewModal.tsx`.
  - Updated `ComposerBottom.tsx` with a Paperclip attachment button and `MessageList.tsx` with rich attachment view rendering.
  - Kept `App.tsx` lean as a pure coordinator.

### 2026-08-21: Multi-Window NSPanel Transparency & Hit-Testing Fix
- **Feature/Fix**: Resolved transparent NSPanel click-blocking and hit-testing on secondary windows.
- **Root Cause**: Transparent window backgrounds were intercepting mouse events on macOS.
- **Exact Fix**: Applied `pointerEvents: "none"` on root window wrappers and `pointerEvents: "auto"` on inner content containers.

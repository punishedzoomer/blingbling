# Bugfixes and Architecture Log

## Architecture Context & Bug Log

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

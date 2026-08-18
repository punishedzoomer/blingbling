# Project Rules, Mistakes to Avoid, and Upcoming Features

**Purpose**: To ensure critical architectural context is preserved across agent sessions and prevent past mistakes from recurring.

## 1. Core Architectural Mistakes to Avoid
- **DO NOT delete or modify `v2/src-tauri/src/websocket.rs`:** This file is NOT unused or leftover code. It is the critical WebSocket server that listens on port `14444` and bridges the Chrome/Firefox extension to the desktop application.
- **DO NOT overwrite Tauri hooks:** In `v2/src-tauri/src/lib.rs`, `tauri::Builder::default().setup(|app| { ... })` must only be called ONCE. Adding a second `.setup()` hook will silently overwrite the first one, causing background services (like the WebSocket server) to silently fail to launch.
- **App Foregrounding on Snip:** When the `App.tsx` frontend receives an `extension-snip-received` event from the WebSocket, it MUST call `invoke("show_panel", { label: "main" })` so the desktop app pops out of the background.
- **Cursor UI over LLM Text:** The app uses a global `cursor: default` and `user-select: none` to mimic native UI. When styling AI or User chat bubbles that have selectable text, ensure you explicitly add `cursor: text;` to those CSS classes, otherwise hovering over selectable text remains an arrow.

## 2. Upcoming Features Tracking
- Always review and update `/Users/home/Projects/crackit/upcoming_features.md` before starting major new work or if the user is deciding what to tackle next.
- The `upcoming_features.md` document tracks both planned features (like Raycast integration, improved previews, voice support, PDF support, tutorials, and master prompts) and active development tasks.

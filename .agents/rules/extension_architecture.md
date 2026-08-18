# Browser Extension Architecture

## Critical Components
The browser extension (`extension/`) communicates with the main Tauri desktop app (`v2/`) using a local WebSocket server.

1. **WebSocket Server**:
   - The Rust backend spins up a WebSocket server in `v2/src-tauri/src/websocket.rs` on `ws://127.0.0.1:14444`.
   - It is initialized inside the `setup` hook in `v2/src-tauri/src/lib.rs`.
   - **CRITICAL**: Never remove `websocket.rs` or the `start_server` initialization, as this is the only bridge between the browser extension and the desktop app. Cargo may flag it as "unused code" depending on how it's linked; ignore this.

2. **Frontend Listener**:
   - The React frontend (`v2/src/App.tsx`) listens for the `extension-snip-received` event emitted by the WebSocket server.
   - Upon receiving a base64 snip from the extension, it must immediately call `invoke("show_panel", { label: "main" })` to pop the chat window to the foreground so the user sees the newly captured image.

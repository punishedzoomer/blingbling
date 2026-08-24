# Bling Bling (v2)

Desktop AI Assistant powered by Tauri 2.0, React 19, and Rust.

## Development Commands

### 1. Normal Development (Quiet Mode)
Runs the desktop app with devtools. All repetitive debug messages are silenced by default:
```bash
npm run tauri dev
```

### 2. Debug Mode (Verbose Window & IPC Logs)
Enables full terminal logging (panel transitions, child window attachments, IPC calls, etc.):
```bash
# Option A: using the dedicated npm script
npm run dev:debug

# Option B: using Tauri CLI flag
npm run tauri dev -- --debug

# Option C: using environment variable
DEBUG=1 npm run tauri dev
# OR
BLING_DEBUG=1 npm run tauri dev
```

### 3. Type Checking & Building
```bash
# Check TypeScript types
npx tsc --noEmit

# Check Rust backend
cd src-tauri && cargo check

# Build production app bundle
npm run tauri build
```

## Recommended IDE Setup
- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)


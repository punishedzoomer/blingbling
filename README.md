<p align="center">
  <img src="v2/src-tauri/icons/icon.png" width="128" alt="Bling Bling Logo">
  <h1 align="center">Bling Bling</h1>
  <p align="center">
    A sleek, AI-powered desktop assistant built with Tauri 2.0, React, and Rust.<br>
    Runs as a native macOS accessory — invisible in your Dock, instantly available via global shortcut.
  </p>
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS-000000?style=flat-square&logo=apple&logoColor=white">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2.0-24C8DB?style=flat-square&logo=tauri&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.80+-DEA584?style=flat-square&logo=rust&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
</p>

---

## Why Bling Bling?

Most AI chat apps feel like web pages wrapped in Electron — heavy, slow, and locked to one provider. Bling Bling is different:

| **Design Goal** | **How Bling Bling Does It** |
|---|---|
| **Zero friction** | Global hotkey → instant overlay. No Dock icon, no app switcher clutter. |
| **Model freedom** | Bring your own OpenRouter key. Switch between 100+ models (Claude, GPT, Gemini, DeepSeek, Llama, Mistral, …) in one click. |
| **Local-first** | Conversations, tags, notebooks, and prompts live in *your* filesystem. No cloud sync unless you want it. |
| **Native performance** | Rust backend handles screen capture, streaming, and window management. React frontend stays light. |
| **Extensible** | Browser extension captures any webpage element and beams it straight into chat. |

---

## Screenshots

> **Add your screenshots here!** Replace the placeholder paths below with actual images in a `docs/assets/` folder.

| Main Chat (Glassmorphism Overlay) | Notebooks — Organize by Project |
|:---:|:---:|
| ![Main Chat](docs/assets/main-chat.png) | ![Notebooks](docs/assets/notebooks.png) |

| Settings — Model Selection & API Usage | Browser Extension — Capture Any Element |
|:---:|:---:|
| ![Settings](docs/assets/settings.png) | ![Extension](docs/assets/extension.png) |

| Command Palette (`/tag`) | Screen Snip (Native macOS) |
|:---:|:---:|
| ![Tags](docs/assets/tags.png) | ![Snip](docs/assets/snip.png) |

---

## Core Features

### True Accessory Mode (macOS)
- Runs as an **NSPanel** — floats above all windows, visible on all Spaces, no Dock icon, no Cmd+Tab entry.
- Summoned instantly via global shortcut (configured in Settings).
- Auto-resizes to content; glassmorphism backdrop blends with macOS.

### Multi-Model via OpenRouter
- **One API key → 100+ models.** No vendor lock-in.
- Three model slots: **Quick** (fast/cheap), **Smart** (balanced), **Ultra** (reasoning-heavy).
- Settings fetches live model list from OpenRouter with pricing, searchable dropdown.
- Real-time API usage/cost tracking in Settings.

### Notebooks — Project-Centric Conversations
- Create notebooks with custom colors.
- Each notebook gets an auto-managed **tag** — conversations tagged with it are locked to that notebook.
- **New Chat** button starts a conversation pre-tagged.
- **Add from History** drawer lets you assign existing chats to a notebook.
- Sessions persist with `notebookId` + `tagId`; restore opens the main chat with context intact.

### Tag System (Inline & Persistent)
- Type `/tag #name` in chat to create/assign tags instantly.
- Tags sync across windows via `localStorage` + Tauri events.
- Color-coded chips in conversation lists.
- Notebook tags are **locked** — cannot be removed while inside that notebook.

### Native Screen Capture
- **Full-screen** (`capture_screen`) or **interactive region** (`capture_screen_interactive`) via macOS `screencapture`.
- Images compressed to JPEG (max 1920px wide) → base64 → sent inline with your prompt.
- No Electron `desktopCapturer` overhead — pure Rust + system binary.

### Browser Extension ("Widget")
- **Manifest V3** extension (Chrome/Firefox/Edge).
- **Element picker**: hover any element → click → precise crop sent to desktop app.
- **Visible-tab capture** + optional **harvested images** (product grids, galleries, etc.).
- **Persistent queue**: snips survive browser restarts; flushed when desktop app reconnects.
- WebSocket (`ws://127.0.0.1:14444`) for real-time push.

### Quick Action Buttons
- Four customizable buttons under the composer (Solve, Explain, Optimize, Debug by default).
- Each has a label + system prompt. Editable in Settings → Prompts.
- One-click: captures screen (if needed) + sends preset prompt.

### Local-First Persistence
- Conversations stored as JSON in `~/Library/Application Support/BlingBling/sessions/`.
- Tags, notebooks, button configs in `localStorage` (synced across windows via `storage` event).
- Trash/soft-delete with restore.
- No telemetry, no forced cloud.

### Rich Markdown Rendering
- **GFM** (tables, task lists, strikethrough).
- **KaTeX** math (`$inline$`, `$$block$$`).
- **Syntax highlighting** (Prism via `react-syntax-highlighter`).
- Copy-to-clipboard on code blocks.
- Collapsible context/attachment sections.

### Keyboard-First UX
- `Enter` = send, `Shift+Enter` = newline.
- `/tag #name` inline tagging.
- `Esc` = cancel streaming / close panels.
- Global shortcut to summon/hide (set in Settings).



## Installation

### Option 1: Download Release (macOS)
1. Go to [**Releases**](../../releases)
2. Download `Bling Bling.dmg`
3. Open → drag to `Applications`
4. First launch: right-click → **Open** (macOS Gatekeeper)

### Option 2: Build from Source
```bash
# Prerequisites: Node.js 20+, Rust 1.80+, Xcode Command Line Tools
cd v2
npm install
npm run tauri build -- --bundles dmg
# Output: v2/src-tauri/target/release/bundle/macos/Bling Bling.dmg
```

### Browser Extension
- **Chrome/Edge**: Load `extension/` as unpacked (Developer mode)
- **Firefox**: `about:debugging` → Load Temporary Add-on → `manifest.json`
- Shortcut: `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) to capture element

---

## Configuration

| Setting | Location | Description |
|---|---|---|
| OpenRouter API Key | Settings → General | Your `sk-or-v1-...` key |
| Quick / Smart / Ultra Model | Settings → General | Dropdown (live from OpenRouter) |
| Global Shortcut | Settings → General | Via `@tauri-apps/plugin-global-shortcut` |
| Quick Action Buttons | Settings → Prompts | Label + system prompt each |
| Custom Tags | Settings → Tags | Auto-created via `/tag`; editable here |
| Notebooks | Notebook window (hotkey) | Create, color, rename, delete |

> **Tip:** The extension connects to `ws://127.0.0.1:14444`. Make sure the desktop app is running.

---

## Development

```bash
# Frontend dev server (with HMR)
cd v2 && npm run dev

# Tauri dev (opens app with devtools)
cd v2 && npm run tauri dev

# Type-check
cd v2 && npx tsc --noEmit

# Lint (if configured)
cd v2 && npm run lint
```

**Project structure:**
```
Bling Bling/
├── v2/                          # Tauri app
│   ├── src/                     # React frontend
│   │   ├── components/          # UI components
│   │   ├── hooks/               # useAttachments, etc.
│   │   ├── utils/               # fileProcessor, notebookTags
│   │   ├── App.tsx              # Main chat window
│   │   ├── NotebookApp.tsx      # Notebook manager
│   │   ├── HistoryApp.tsx       # Conversation history
│   │   ├── SettingsApp.tsx      # Settings (models, prompts, tags)
│   │   └── main.tsx             # Entry (routes by window label)
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── commands/        # Tauri commands
│   │   │   │   ├── ai.rs        # OpenRouter streaming
│   │   │   │   ├── screen.rs    # Native screen capture
│   │   │   │   ├── session.rs   # JSON session CRUD
│   │   │   │   ├── window.rs    # NSPanel show/hide/focus
│   │   │   │   └── file.rs      # File picker
│   │   │   ├── lib.rs           # App setup, NSPanel swizzle
│   │   │   └── main.rs
│   │   └── tauri.conf.json      # Window defs, bundle config
│   └── package.json
├── extension/                   # Browser extension (MV3)
│   ├── manifest.json
│   ├── background.js            # WebSocket + queue
│   └── content.js               # Element picker + crop
└── Docs/
    ├── full_windowed_mode.md    # Planned unified-window architecture
    ├── performance_audit.md     # Known perf watchlist
    └── bugfixes.md              # Historical fixes
```

---

## Roadmap / Planned

- [ ] **Full Windowed Mode** — single `app-shell` window with sidebar (see `Docs/full_windowed_mode.md`)
- [ ] Linux/Windows ports (NSPanel → layer-shell / Win32 toolwindow)
- [ ] Plugin system for custom tools (MCP-style)
- [ ] Semantic search over history (local embeddings)
- [ ] Sync via iCloud / Git / custom WebDAV
- [ ] Voice input (Whisper local)

## License

MIT — see [LICENSE](LICENSE) (add one if missing).

---

## Acknowledgments

- [Tauri](https://tauri.app/) — for making Rust + WebView delightful
- [OpenRouter](https://openrouter.ai/) — unified model access
- [Lucide](https://lucide.dev/) — beautiful icons
- [KaTeX](https://katex.org/) / [Prism](https://prismjs.com/) — math & code rendering

---

<p align="center">
  Made for people who want AI on their terms.
</p>
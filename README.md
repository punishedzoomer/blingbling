# Bling Bling Assistant

Bling Bling is a sleek, AI-powered desktop assistant for macOS. Rebuilt from the ground up in V2, it abandons the old PyQt5 foundation in favor of a lightning-fast **Tauri 2.0 + React** stack. It is designed to act as a seamless system accessory—invisible in your Dock, but instantly available via global shortcuts.

## Features

- **True Accessory Mode:** Bling Bling runs as a macOS accessory process. It doesn't clutter your Dock or app switcher.
- **Glassmorphism Design:** A beautiful, transparent, auto-resizing overlay that blends smoothly into your macOS environment.
- **Instant Screen Capture:** Native macOS screen snipping using Rust, allowing you to seamlessly provide visual context to the AI.
- **Multi-Model Intelligence:** Powered by OpenRouter, allowing you to easily switch between advanced reasoning models (like Claude 3.5 Sonnet, Kimi K3, and Gemini 3.7) and lightweight models depending on your needs.
- **Persistent History:** Your conversations are automatically saved locally and can be browsed or restored at any time.

## Project Architecture

The codebase is split into a modern web frontend and a robust Rust backend:

### 1. The Rust Backend (`v2/src-tauri/`)
- **`lib.rs` / `main.rs`:** The core entry points. Configures the Tauri application, registers system-wide shortcuts, and swizzles Tauri webviews into native `NSPanel` objects using Objective-C bindings so the app can float above fullscreen windows.
- **`commands/ai.rs`:** Handles communication with the OpenRouter API, including streaming server-sent events (SSE) back to the frontend.
- **`commands/screen.rs`:** Uses `xcap` and native macOS commands to trigger the interactive screen capture tool (`screencapture -i`) and process the resulting images.
- **`commands/session.rs`:** Manages the filesystem, allowing conversations to be seamlessly serialized to JSON and saved in the macOS Application Support directory.
- **`commands/window.rs`:** The bridge to macOS native window management. Handles dynamic resizing, focusing, hiding, and centering the `NSPanel` interfaces.

### 2. The React Frontend (`v2/src/`)
- **`App.tsx`:** The main chat overlay interface. Handles the auto-resizing text area, markdown rendering, and the conversational state machine.
- **`SettingsApp.tsx`:** The settings panel for configuring your OpenRouter API key, selecting default models, and toggling development features.
- **`HistoryApp.tsx`:** The sidebar interface that parses local JSON session files, sorts them chronologically, and allows you to jump back into previous chats.
- **`useDynamicBounds.ts`:** A custom React hook that uses `ResizeObserver` to constantly sync the HTML document's dimensions with the native macOS window frame, ensuring the transparent window perfectly wraps your content.
- **`App.css`:** The design system. Relies heavily on flexbox, CSS variables, and `-webkit-backdrop-filter` for the frosted glass effects.

## Building for Production

To compile a native macOS `.app` bundle:
```bash
cd v2
npm install
npm run tauri build
```
The finished application will be located at `v2/src-tauri/target/release/bundle/macos/Bling Bling.app`.

*(Note: The V1 Python/PyQt5 source code has been moved to the `v1/` directory for historical reference.)*

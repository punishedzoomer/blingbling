<div align="center">
  <img src="v2/src-tauri/icons/icon.png" width="128" alt="Bling Bling Logo">
  <h1>Bling Bling Assistant</h1>
  <p>A sleek, AI-powered desktop assistant rebuilt from the ground up with Tauri 2.0 and React.</p>
</div>

---

<!-- [INSERT DEMO VIDEO PLACEHOLDER HERE] -->
<!-- e.g. <img src="demo.gif" alt="Bling Bling Demo"> -->

Bling Bling is designed to act as a seamless system accessory—invisible in your Dock, but instantly available via global shortcuts. 

<!-- [INSERT SCREENSHOT PLACEHOLDER HERE] -->
<!-- e.g. <img src="screenshot.png" alt="Bling Bling Screenshot"> -->

## Features

- **True Accessory Mode:** Runs as a native macOS accessory process. It doesn't clutter your Dock or app switcher.
- **Glassmorphism Design:** A beautiful, transparent, auto-resizing overlay that blends smoothly into your macOS environment.
- **Instant Screen Capture:** Native macOS screen snipping using Rust, allowing you to seamlessly provide visual context to the AI.
- **Multi-Model Intelligence:** Powered by OpenRouter, switch between reasoning models (Claude 3.5 Sonnet, Gemini 1.5 Pro) and lightning-fast local models based on your needs.
- **Persistent History:** Your conversations are automatically saved locally and can be browsed or restored at any time.

## Installation (macOS)

You can install Bling Bling on macOS in two ways:

### Option 1: Download the `.dmg`
1. Go to the [Releases](../../releases) page of this repository.
2. Download the latest `Bling Bling.dmg` file.
3. Open the `.dmg` and drag the **Bling Bling** app into your `Applications` folder.
4. Launch the app (you may need to right-click and select "Open" the first time due to macOS security).

### Option 2: Build from source
If you prefer to compile the app yourself:
```bash
# Ensure you have Node.js and Rust installed
cd v2
npm install
npm run tauri build -- --bundles dmg
```
Your compiled `.dmg` and `.app` will be located in `v2/src-tauri/target/release/bundle/macos/`.

## Help Wanted: Linux & Windows Ports

Currently, Bling Bling heavily relies on macOS-specific native APIs (like `NSPanel` for floating windows and `screencapture` for snipping) to achieve its seamless, accessory-style behavior.

**We are actively looking for contributors to help port these native features to Linux and Windows!** 

If you have experience with Windows APIs (e.g. `Win32`, `WS_EX_TOOLWINDOW`) or Linux window managers (X11/Wayland layer shells), we would love your help adapting the `.setup()` hooks in `v2/src-tauri/src/lib.rs` to make Bling Bling completely cross-platform.

---

*(Note: The legacy V1 Python/PyQt5 source code has been moved to the `v1/` directory for historical reference.)*

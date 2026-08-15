# BlingBling Assistant

BlingBling is an advanced, overlay-style AI assistant built with PySide6 (Qt) and Python, featuring transparent frameless windows, screenshot snipping integration, and multi-model backend capabilities via OpenRouter.

## Project Architecture

To keep the application highly maintainable and easy to debug, the codebase is modularized into distinct components:

### 1. `main.py`
**The Entry Point.** This is a lightweight script that simply initializes the Qt application, instantiates the main window, and injects necessary native macOS bindings before starting the event loop.

### 2. `app_window.py`
**The Core UI Layout.** Contains the `AssistantOverlay` class. This file is responsible for assembling the main window, managing the sidebar (history and settings), connecting signals, handling session state, and processing window dragging logic.

### 3. `chat_widgets.py`
**Modular UI Components.** Contains custom widgets designed for the chat interface:
- `MessageWidget`: The container for individual chat messages, which includes logic for toggleable reasoning drops and Markdown rendering.
- `AutoResizingTextEdit`: The dynamic text input box that grows with the user's input and supports `Shift+Enter` for newlines.

### 4. `backend.py`
**The AI Logic.** Contains the `LLMWorker` class which handles the threading and API requests to OpenRouter. It manages the two-stage pipeline: OCR (vision processing) followed by advanced reasoning.

### 5. `session_manager.py`
**Data Persistence.** Handles the loading, saving, and parsing of user chat sessions to the local `sessions/` directory. It includes logic to auto-generate session titles based on OCR context or user prompts.

### 6. `mac_utils.py`
**Native Bindings.** Contains C-types Python wrappers that communicate with the compiled Objective-C library (`mac_overlay.dylib`). This handles forcing the frameless Qt window to float above fullscreen applications on macOS.

### 7. `snipping_tool.py`
**Screen Capture.** Contains the `SnippingWidget`, a transparent full-screen overlay that lets the user click-and-drag to capture regions of their screen.

### 8. `config.py`
**Configuration.** Houses API keys, model lists, and default UI settings (like `WINDOW_OPACITY`).

### 9. `style.qss`
**Theming.** The CSS-like stylesheet that dictates the visual appearance of the application, prioritizing a sleek, glassmorphism design.

# Bugfixes & Architecture Log

This document tracks core architectural bugs and state management issues to ensure future agents have full context on previous pitfalls.

### August 18, 2026

#### 1. Tauri State Management Panic (stream_ai_response)
- **Symptom:** UI would silently fail to respond after sending a message. No "Thinking..." indicator, buttons remained active. No alert popup.
- **Root Cause:** The `stream_ai_response` Tauri command takes a `tauri::State<'_, AiState>` to handle streaming cancellation. However, `AiState` was never registered in the `tauri::Builder` using `.manage()`. This caused a hard backend panic which rejected the Promise silently on the frontend (since the native `alert` was swallowed by the `NSPanel` window).
- **Fix:** Added `.manage(AiState { cancel_flag: AtomicBool::new(false) })` to `v2/src-tauri/src/lib.rs`.

#### 2. Premature isThinking State Cancellation
- **Symptom:** AI would stream responses, but the "Thinking..." UI pulse would instantly disappear the millisecond the first chunk arrived.
- **Root Cause:** The `listen("ai-response")` event handler in `App.tsx` was unconditionally calling `setIsThinking(false)` upon receiving any chunk, rather than waiting for the `[DONE]` flag.
- **Fix:** Removed `setIsThinking(false)` from the top of the event handler; it is now strictly enforced only when `chunk === "[DONE]"`.

#### 3. Tauri NSPanel Async Winit Desync Panic
- **Symptom:** Rapidly opening and closing auxiliary panels (e.g. History, Settings) 4-5 times in a row causes a hard application crash.
- **Root Cause:** Mixing standard asynchronous Tauri commands (`window.hide()`) with synchronous native Objective-C commands (`makeKeyAndOrderFront:`) causes the underlying Winit event queue to desync from the actual macOS window manager state, resulting in a panic.
- **Fix:** Stripped out `window.hide()` entirely. All `NSPanel` visibility transitions are now strictly handled by raw Objective-C (`orderOut:` and `makeKeyAndOrderFront:`) to bypass the Winit queue and guarantee thread-safe synchronicity.

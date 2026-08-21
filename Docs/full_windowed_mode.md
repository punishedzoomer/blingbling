# Full Windowed Mode — Implementation Guide

A blueprint for unifying the multi-panel NSPanel floating overlay (current
"Widget Mode") with a full-size, conventional macOS app shell ("Windowed Mode")
behind a single user-facing toggle. The goal is to keep every existing surface
(chat, history, notebooks, settings, tutorial, snip) running inside one cohesive
window without rewriting the React components from scratch.

---

## 1. Goals & Non-Goals

**Goals**
- Provide a single, conventional app window that contains the chat composer,
  the live AI stream, and side panels for history, notebooks, settings, and
  tutorial.
- Reuse the current React components, hooks, and Tauri commands verbatim. No
  logic is duplicated; only the chrome (toolbar, drag handle, side panel
  containers) and windowing strategy change.
- Persist the user's mode selection across launches.
- Allow toggling between modes at runtime without reloading state or losing an
  in-flight AI stream.

**Non-Goals**
- Replacing the per-window Tauri configuration with a single SPA in
  development. The multi-window build remains available for the legacy
  widget mode.
- Refactoring the React state model (messages, sessions, tags, attachments).
- Introducing a new framework or router.

---

## 2. Current Architecture (Recap)

| Surface    | Window label | React entry            | Tauri config location        |
|------------|--------------|------------------------|------------------------------|
| Chat       | `main`       | `v2/src/App.tsx`       | `v2/src-tauri/tauri.conf.json` |
| History    | `history`    | `v2/src/HistoryApp.tsx`| `tauri.conf.json`            |
| Notebooks  | `notebook`   | `v2/src/NotebookApp.tsx`| `tauri.conf.json`           |
| Settings   | `settings`   | `v2/src/SettingsApp.tsx`| `tauri.conf.json`           |
| Tutorial   | `tutorial`   | `v2/src/TutorialApp.tsx`| `tauri.conf.json`           |
| Snip       | `snip`       | `v2/src/SnipApp.tsx`   | `tauri.conf.json`            |

- `v2/src/main.tsx` is a tiny router that branches on
  `getCurrentWindow().label` and renders the appropriate React root.
- `v2/src-tauri/src/lib.rs` converts every webview into an `NSPanel` and
  forces `Accessory` activation policy + `NSScreenSaverWindowLevel`.
- `v2/src-tauri/src/commands/window.rs` provides `show_panel`, `hide_panel`,
  `open_main_chat`, `focus_panel`, `unfocus_panel`, `resize_panel`.
- The toolbar (`v2/src/components/Toolbar.tsx`) calls
  `getCurrentWindow().startDragging()` from a `.drag-handle` div. The window
  itself is frameless and transparent, so the entire "window" identity lives in
  the React chrome.

---

## 3. Target Architecture

Two parallel Tauri windows are added to the configuration:

- `widget-overlay` — the existing chat-only NSPanel. Replaces the current
  `main` label once windowed mode exists; otherwise `main` stays as-is and
  `widget-overlay` is its mirror.
- `app-shell` — a **new** conventional window. It is `decorations: true`,
  `transparent: false`, has a `titleBarStyle`, normal `level` (default), and
  owns one React root (`AppShell.tsx`) that hosts an in-app layout:

```
+--------------------------------------------------------------+
| Title bar (native) | "BlingBling"            [Widget] [Quit] |
+---------+----------------------------------------------------+
| Sidebar | Active surface area (chat / history / notebooks)  |
|  Chat   |                                                    |
|  Hist.  |   <ConversationList | MessageList | Composer>      |
|  Notes  |                                                    |
|  Tuto.  |                                                    |
|  Sett.  |                                                    |
+---------+----------------------------------------------------+
```

The toggle button switches between `widget-overlay` and `app-shell`. Both
windows read/write the same `localStorage`, dispatch the same
`restore-session` event, and listen on the same Tauri event bus, so the
underlying state is identical.

---

## 4. Implementation Phases

### Phase 0 — Decision: mode flag plumbing
- Add a `mode` key in `localStorage` (`"widget" | "windowed"`, default
  `"widget"`).
- Add a Tauri command `set_app_mode(mode: String, app: AppHandle)` that
  reads the flag and dispatches the right window-show/window-hide sequence.
- Add `get_app_mode` for the React side.
- Persist the mode in `tauri.conf.json` so the launcher can pick the right
  default window.

### Phase 1 — Add the new app-shell window
1. `v2/src-tauri/tauri.conf.json`
   - Add a new window entry:
     ```json
     {
       "title": "BlingBling",
       "label": "app-shell",
       "width": 1100,
       "height": 760,
       "minWidth": 720,
       "minHeight": 480,
       "decorations": true,
       "transparent": false,
       "alwaysOnTop": false,
       "visibleOnAllWorkspaces": false,
       "titleBarStyle": "Overlay",
       "visible": false
     }
     ```
   - Keep the current `main`/`history`/`notebook`/... entries. They now
     represent "widget mode" surfaces.
2. In `v2/src-tauri/src/lib.rs` `setup`:
   - Branch on the persisted mode.
   - If `widget`: run the existing NSPanel swizzling loop and call
     `panel.show()` on the chat `main` panel.
   - If `windowed`: skip NSPanel swizzling for `app-shell` only; call
     `app.get_webview_window("app-shell").unwrap().show()`.
3. Update `WindowEvent::CloseRequested` so `app-shell` is allowed to actually
   close (and trigger `quit_app` semantics), while NSPanel windows still
   `orderOut` on close as before.

### Phase 2 — React entry & in-app layout
1. `v2/src/main.tsx`: add a branch for `app-shell` rendering
   `<AppShell />`.
2. `v2/src/AppShell.tsx` (new file):
   - Holds local state `surface: "chat" | "history" | "notebooks" |
     "settings" | "tutorial"`.
   - Renders a sidebar that mirrors what is currently separate windows.
   - Renders the active surface in the main area. For the first pass,
     surfaces are imported from the existing apps and rendered with
     default props, e.g.:
     ```tsx
     import { HistoryApp } from "./HistoryApp";
     import { NotebookApp } from "./NotebookApp";
     import { SettingsApp } from "./SettingsApp";
     import { TutorialApp } from "./TutorialApp";
     ```
     and they mount their own panels inside a `<div className="surface">`.
   - The chat surface renders `<App />` from `v2/src/App.tsx` unchanged
     (it owns its state). To share state between surfaces, the existing
     `restore-session` event already broadcasts the active session; the
     `AppShell` re-emits it on the inner windows using `emit("restore-session",
     payload)`.
3. Sidebar buttons: clicking one swaps the active surface; deep links
   (currently `blingbling://`) emitted by the extension keep working — the
   command `show_panel` is updated to also dispatch an in-app
   `set_active_surface` event.
4. Title bar: a small floating control in the top right with the toggle
   ("Switch to Widget Mode"), `set_app_mode("widget")`. The icon mirrors
   the existing megaphone/Tutorial control.

### Phase 3 — Toolbar adaptation
The current `Toolbar` component expects to be on an NSPanel: it calls
`getCurrentWindow().startDragging()` and provides a `drag-pill` to act as a
fake title bar. Inside `app-shell` we use a real native title bar, so:

1. Detect mode from a prop or context: `const useNativeFrame =
   window.__TAURI_INTERNALS__.metadata.currentWindow.label === "app-shell"`.
2. In `AppShell`, render the native frame control. Don't mount the existing
   `Toolbar` at all when the surface is `chat` and we are inside the
   `app-shell` window. Hide the `drag-pill` and drag-related buttons.
3. Provide equivalents inside the in-app chrome: a `Quit`, a `Hide`, a
   `Stop` button (already covered by `ActionButtons`), and a
   `Switch to Widget Mode` button.
4. The NSPanel chat path remains untouched, so widget mode keeps working.

### Phase 4 — Cross-surface event plumbing
- Reuse existing `restore-session`, `history-sync`, and `customTags`
  events. When a chat inside `app-shell` opens a notebook detail or
  history list, the `AppShell` re-routes the request internally instead
  of calling `show_panel`.
- Add a new event `set_active_surface { surface: string }` for in-app
  navigation.
- Keep `show_panel`/`hide_panel` functional for the widget mode path
  only.

### Phase 5 — Side panel specifics
- **History**: today the `history` window floats to the right of the chat.
  In windowed mode, render `<HistoryApp />` inside the sidebar's "History"
  surface. The component already fetches sessions from
  `load_sessions`; no API change required.
- **Notebooks**: same treatment. `NotebookApp` reads `customNotebooks` and
  emits `restore-session`; reuse it as-is.
- **Settings**: mount inside the settings surface. The
  "Master Prompts", "Workflows", and "Tutorial" tabs already work as
  standalone pages; treat them as in-app tabs.
- **Snip**: a screen-capture surface. In windowed mode, keep using the
  existing NSPanel `snip` window — it has a special 1920x1080 transparent
  setup. The `app-shell` should not absorb it. Trigger it the same way
  (`capture_screen` / `capture_screen_interactive`) and continue to show
  the dedicated window.

### Phase 6 — Persistence & defaults
- Default the new app's `mode` to whatever the user last chose.
- Migration: on first run with the new config, if the user has been using
  widget mode, leave the mode as `widget`; otherwise pick `windowed`.
- Update the Settings page to expose the toggle as a radio/segmented
  control: "Widget Mode" / "Windowed Mode".

### Phase 7 — Polish
- Smooth transition between modes: when toggling to windowed mode,
  capture the chat's current session id and re-emit `restore-session` on
  the `app-shell` window so the user keeps their context.
- Update `useDynamicBounds` so the `app-shell` does **not** auto-resize
  the way the NSPanel does. The dynamic height logic is a no-op for the
  shell window.
- Add CSS to `AppShell.module.css` (or scoped inside `AppShell.tsx`) for
  the sidebar, surface container, and title bar. Keep the existing
  widget look intact.

---

## 5. Code-Level Sketch

Below is a *rough* sketch (not a runnable patch) illustrating the shape of
the changes. Use it as a reference while implementing.

### 5.1 `v2/src-tauri/tauri.conf.json`
```jsonc
{
  "app": {
    "windows": [
      { "label": "main", /* existing widget chat panel */ },
      { "label": "history", /* existing */ },
      { "label": "notebook", /* existing */ },
      { "label": "settings", /* existing */ },
      { "label": "tutorial", /* existing */ },
      { "label": "snip", /* existing */ },
      {
        "label": "app-shell",
        "title": "BlingBling",
        "width": 1100,
        "height": 760,
        "minWidth": 720,
        "minHeight": 480,
        "decorations": true,
        "transparent": false,
        "alwaysOnTop": false,
        "visibleOnAllWorkspaces": false,
        "titleBarStyle": "Overlay",
        "visible": false
      }
    ]
  }
}
```

### 5.2 `v2/src-tauri/src/lib.rs` — mode-aware setup
```rust
let mode = std::env::var("BLINGBLING_MODE")
    .unwrap_or_else(|_| "widget".to_string());

if mode == "windowed" {
    if let Some(win) = app.get_webview_window("app-shell") {
        let _ = win.show();
        let _ = win.set_focus();
    }
} else {
    // existing NSPanel swizzling loop
}
```

### 5.3 `v2/src-tauri/src/commands/window.rs` — new commands
```rust
#[tauri::command]
pub fn set_app_mode(mode: String, app: AppHandle) {
    // Persist mode, hide the current top-level window, show the new one.
    let shell = app.get_webview_window("app-shell");
    let main  = app.get_webview_window("main");
    match mode.as_str() {
        "windowed" => {
            if let Some(w) = main  { w.hide().ok(); }
            if let Some(w) = shell { w.show().ok(); }
        }
        "widget" => {
            if let Some(w) = shell { w.hide().ok(); }
            if let Some(w) = main  { w.show().ok(); }
        }
        _ => {}
    }
}
```

### 5.4 `v2/src/main.tsx` — branch for `app-shell`
```tsx
if (label === "app-shell") {
  return <AppShell />;
}
```

### 5.5 `v2/src/AppShell.tsx` — new root
```tsx
type Surface = "chat" | "history" | "notebook" | "settings" | "tutorial";

export function AppShell() {
  const [surface, setSurface] = useState<Surface>("chat");

  return (
    <div className="app-shell">
      <Sidebar surface={surface} onChange={setSurface} />
      <main className="app-shell-main">
        {surface === "chat"      && <App />}
        {surface === "history"   && <HistoryApp />}
        {surface === "notebook"  && <NotebookApp />}
        {surface === "settings"  && <SettingsApp />}
        {surface === "tutorial"  && <TutorialApp />}
      </main>
      <button
        className="mode-toggle"
        onClick={() => invoke("set_app_mode", { mode: "widget" })}
      >
        Switch to Widget Mode
      </button>
    </div>
  );
}
```

### 5.6 `v2/src/components/Sidebar.tsx` — new file
```tsx
const items: { id: Surface; label: string }[] = [
  { id: "chat",     label: "Chat" },
  { id: "history",  label: "History" },
  { id: "notebook", label: "Notebooks" },
  { id: "settings", label: "Settings" },
  { id: "tutorial", label: "Tutorial" },
];
```

### 5.7 Toolbar guard
```tsx
const useNativeFrame =
  window.__TAURI_INTERNALS__.metadata.currentWindow.label === "app-shell";
{!useNativeFrame && <Toolbar {...toolbarProps} />}
```

---

## 6. Risks & Open Questions

1. **Re-mounting React state** — moving the chat from the `main` NSPanel
   into the `app-shell` will remount the component. We must capture the
   active session id and re-emit `restore-session` so the chat rehydrates
   with the same conversation, tags, and attachments.
2. **Dragging and NSPanel hit-testing** — the `app-shell` uses the OS
   title bar; the `drag-pill` becomes dead UI. Remove it inside
   `app-shell`.
3. **Transparent CSS** — the current `App.css` has many
   `backdrop-filter` and `glass` rules tuned for a transparent floating
   surface. Windowed mode may want a less blurry, more solid panel —
   introduce a `data-mode="windowed"` attribute on `<body>` and scope
   overrides.
4. **Snip window** — leave as a dedicated NSPanel. Don't try to embed a
   1920x1080 transparent capture surface in the app shell.
5. **Tray icon / global hotkey** — when in windowed mode, the menu bar
   icon should still respond to the global shortcut to summon the window.
6. **Windowed mode on Windows / Linux** — `app-shell` is platform-agnostic;
   the NSPanel swizzling only runs on macOS via `cfg(target_os = "macos")`,
   so non-macOS users will land in windowed mode by default.

---

## 7. Step-by-Step Checklist (for the implementer)

1. Create the `app-shell` window in `tauri.conf.json`.
2. Add the `set_app_mode` Tauri command and a `BLINGBLING_MODE` env var
   defaulting to `widget` until the user toggles.
3. Branch `v2/src/main.tsx` for `app-shell`.
4. Implement `AppShell.tsx` with the sidebar/surface layout, reusing
   `App`, `HistoryApp`, `NotebookApp`, `SettingsApp`, `TutorialApp`.
5. Adapt `Toolbar.tsx` to skip rendering in windowed mode and add the
   toggle button.
6. Persist `mode` in `localStorage` and re-apply on app launch.
7. Update `useDynamicBounds` so it does not resize `app-shell`.
8. Audit CSS (`App.css`) and add a `data-mode` attribute to scope
   glass/blur overrides.
9. Update `Settings` page to expose the toggle.
10. Update `Docs/bugfixes.md` with the implementation summary once shipped.

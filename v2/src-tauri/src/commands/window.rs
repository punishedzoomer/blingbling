use std::fs;
use std::path::PathBuf;
use directories::ProjectDirs;
use tauri::{AppHandle, Emitter, Manager};

pub fn get_app_mode_file() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("", "", "BlingBling") {
        let dir = proj_dirs.data_dir();
        fs::create_dir_all(&dir).unwrap_or_default();
        dir.join("app_mode.txt")
    } else {
        let dir = std::env::current_dir().unwrap();
        dir.join("app_mode.txt")
    }
}

pub fn read_app_mode() -> String {
    let path = get_app_mode_file();
    if let Ok(mode) = fs::read_to_string(path) {
        let trimmed = mode.trim().to_string();
        if trimmed == "windowed" || trimmed == "widget" {
            return trimmed;
        }
    }
    "widget".to_string()
}

pub fn write_app_mode(mode: &str) {
    let path = get_app_mode_file();
    let _ = fs::write(path, mode);
}

#[tauri::command]
pub fn get_app_mode() -> String {
    read_app_mode()
}

#[tauri::command]
pub fn set_app_mode(mode: String, app: AppHandle) {
    write_app_mode(&mode);
    let _ = app.emit("app-mode-changed", &mode);

    #[cfg(target_os = "macos")]
    {
        let is_windowed = mode == "windowed";
        let _ = app.run_on_main_thread(move || {
            use objc::{sel, sel_impl, class};
            unsafe {
                let ns_app: cocoa::base::id = objc::msg_send![class!(NSApplication), sharedApplication];
                let policy = if is_windowed {
                    tauri::ActivationPolicy::Regular
                } else {
                    tauri::ActivationPolicy::Accessory
                };
                let _: bool = objc::msg_send![ns_app, setActivationPolicy: policy as i64];
            }
        });
    }

    if mode == "windowed" {
        #[cfg(target_os = "macos")]
        {
            if let (Some(main_win), Some(panel_win)) = (app.get_webview_window("main"), app.get_webview_window("chat-panel")) {
                let main_ns_win = main_win.ns_window().unwrap() as usize;
                let panel_ns_win = panel_win.ns_window().unwrap() as usize;
                let _ = app.run_on_main_thread(move || {
                    let main_ns_win = main_ns_win as cocoa::base::id;
                    let panel_ns_win = panel_ns_win as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl};
                        let parent: cocoa::base::id = objc::msg_send![panel_ns_win, parentWindow];
                        if parent == main_ns_win {
                            let _: () = objc::msg_send![main_ns_win, removeChildWindow: panel_ns_win];
                        }
                    }
                });
            }
        }
        // Hide all widget mode panels
        for label in &["main", "history", "notebook", "settings", "tutorial", "chat-panel"] {
            if let Some(w) = app.get_webview_window(label) {
                #[cfg(target_os = "macos")]
                {
                    use tauri_nspanel::ManagerExt;
                    let lbl = label.clone();
                    if let Ok(panel) = app.get_webview_panel(&lbl) {
                        let _ = app.run_on_main_thread(move || {
                            panel.order_out(None);
                        });
                    } else {
                        let _ = w.hide();
                    }
                }
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = w.hide();
                }
            }
        }
        // Show and focus app-shell
        if let Some(shell) = app.get_webview_window("app-shell") {
            let _ = shell.show();
            let _ = shell.set_focus();
        }
    } else {
        // Hide app-shell
        if let Some(shell) = app.get_webview_window("app-shell") {
            let _ = shell.hide();
        }
        // Show main chat panel
        show_panel("main".to_string(), app.clone());
    }
}

#[tauri::command]
pub fn hide_window(app: AppHandle) {
    let mode = read_app_mode();
    if mode == "windowed" {
        if let Some(shell) = app.get_webview_window("app-shell") {
            shell.hide().unwrap_or_default();
        }
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        window.hide().unwrap_or_default();
    }
    if let Some(window) = app.get_webview_window("chat-panel") {
        window.hide().unwrap_or_default();
    }
}

#[tauri::command]
pub fn quit_app(_app: AppHandle) {
    println!("[RUST DEBUG] quit_app CALLED!");
    // std::process::exit(0);
}

#[tauri::command]
pub fn resize_panel(label: String, width: f64, height: f64, app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        if let Some(window) = app.get_webview_window(&label) {
            let ns_window_ptr = window.ns_window().unwrap() as usize;
            let _ = app.run_on_main_thread(move || {
                let ns_window = ns_window_ptr as cocoa::base::id;
                use objc::{sel, sel_impl};
                unsafe {
                    #[repr(C)]
                    #[derive(Copy, Clone)]
                    struct NSRect {
                        x: f64,
                        y: f64,
                        width: f64,
                        height: f64,
                    }
                    
                    let frame: NSRect = objc::msg_send![ns_window, frame];
                    let content_rect: NSRect = objc::msg_send![ns_window, contentRectForFrameRect:frame];
                    
                    let height_diff = height - content_rect.height;
                    
                    let new_content_rect = NSRect {
                        x: frame.x,
                        y: frame.y - height_diff,
                        width: width,
                        height: height,
                    };
                    
                    let new_frame: NSRect = objc::msg_send![ns_window, frameRectForContentRect:new_content_rect];
                    let _: () = objc::msg_send![ns_window, setFrame:new_frame display:1];
                }
            });
        }
    }
}

#[tauri::command]
pub fn set_debug_mode(debug: bool, app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let sharing_type: cocoa::foundation::NSUInteger = if debug { 1 } else { 0 };
        let mut ns_windows_ptrs = Vec::new();
        for window in app.webview_windows().values() {
            ns_windows_ptrs.push(window.ns_window().unwrap() as usize);
        }
        let _ = app.run_on_main_thread(move || {
            use objc::{sel, sel_impl};
            for ptr in ns_windows_ptrs {
                let ns_window = ptr as cocoa::base::id;
                unsafe {
                    let _: () = objc::msg_send![ns_window, setSharingType: sharing_type];
                }
            }
        });
    }
}

#[tauri::command]
pub fn show_panel(label: String, app: AppHandle) {
    println!("[RUST DEBUG] show_panel called for label: {}", label);
    
    let mode = read_app_mode();
    if mode == "windowed" {
        if let Some(shell) = app.get_webview_window("app-shell") {
            let _ = shell.show();
            let _ = shell.set_focus();
            let _ = app.emit("set-active-surface", &label);
        }
        return;
    }

    if label != "main" && label != "chat-panel" {
        #[cfg(target_os = "macos")]
        {
            if let Some(main_win) = app.get_webview_window("main") {
                let ptr = main_win.ns_window().unwrap() as usize;
                let _ = app.run_on_main_thread(move || {
                    let ns = ptr as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl};
                        let _: () = objc::msg_send![ns, setAlphaValue: 0.0f64];
                        let _: () = objc::msg_send![ns, setIgnoresMouseEvents: cocoa::base::YES];
                    }
                });
            }
            if let (Some(main_w), Some(chat_w)) = (app.get_webview_window("main"), app.get_webview_window("chat-panel")) {
                let main_ptr = main_w.ns_window().unwrap() as usize;
                let chat_ptr = chat_w.ns_window().unwrap() as usize;
                let _ = app.run_on_main_thread(move || {
                    let main_ns = main_ptr as cocoa::base::id;
                    let chat_ns = chat_ptr as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl};
                        let parent: cocoa::base::id = objc::msg_send![chat_ns, parentWindow];
                        if parent == main_ns {
                            let _: () = objc::msg_send![main_ns, removeChildWindow: chat_ns];
                        }
                        let _: () = objc::msg_send![chat_ns, orderOut: cocoa::base::nil];
                    }
                });
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); }
            if let Some(w) = app.get_webview_window("chat-panel") { let _ = w.hide(); }
        }
    }
    
    if label == "chat-panel" {
        if let (Some(main_win), Some(panel_win)) = (app.get_webview_window("main"), app.get_webview_window("chat-panel")) {
            if let (Ok(pos), Ok(size), Ok(psize)) = (main_win.outer_position(), main_win.outer_size(), panel_win.outer_size()) {
                let offset_x = (psize.width as i32 - size.width as i32) / 2;
                let scale_factor = main_win.scale_factor().unwrap_or(1.0);
                let gap = (12.0 * scale_factor) as i32;
                let _ = panel_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: pos.x - offset_x,
                    y: pos.y + size.height as i32 + gap,
                }));
            }
        }
    }
    if let Some(window) = app.get_webview_window(&label) {
        #[cfg(target_os = "macos")]
        {
            let is_main = label == "main";
            let ns_window_ptr = window.ns_window().unwrap() as usize;
            
            let lbl = label.clone();
            let app_clone = app.clone();
            
            let _ = app.run_on_main_thread(move || {
                if is_main {
                    let ns_window = ns_window_ptr as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl, class};
                        let _: () = objc::msg_send![ns_window, setAlphaValue: 1.0f64];
                        let _: () = objc::msg_send![ns_window, setIgnoresMouseEvents: cocoa::base::NO];
                        let _: () = objc::msg_send![ns_window, makeKeyAndOrderFront: cocoa::base::nil];
                        
                        let ns_app: cocoa::base::id = objc::msg_send![class!(NSRunningApplication), currentApplication];
                        let _: bool = objc::msg_send![ns_app, activateWithOptions: 2];
                    }
                } else {
                    use tauri_nspanel::ManagerExt;
                    if let Some(win) = app_clone.get_webview_window(&lbl) {
                        if let Ok(panel) = app_clone.get_webview_panel(&lbl) {
                            let ns_window_ptr = win.ns_window().unwrap() as usize;
                            let _ = app_clone.run_on_main_thread(move || {
                                panel.show();
                                unsafe {
                                    use objc::{sel, sel_impl, class};
                                    let ns_window = ns_window_ptr as cocoa::base::id;
                                    
                                    // Restore NSNonactivatingPanelMask
                                    let style_mask: cocoa::foundation::NSUInteger = objc::msg_send![ns_window, styleMask];
                                    let _: () = objc::msg_send![ns_window, setStyleMask: style_mask | 128];
                                    
                                    let _: () = objc::msg_send![ns_window, setIgnoresMouseEvents: cocoa::base::NO];
                                    let ns_app: cocoa::base::id = objc::msg_send![class!(NSRunningApplication), currentApplication];
                                    let _: bool = objc::msg_send![ns_app, activateWithOptions: 2];
                                }
                            });
                        }
                    }
                }
            });
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
pub fn show_notebook(app: AppHandle) {
    if let Some(window) = app.get_webview_window("notebook") {
        #[cfg(target_os = "macos")]
        {
            let ns_window_ptr = window.ns_window().unwrap() as usize;
            let _ = app.run_on_main_thread(move || {
                let ns_window = ns_window_ptr as cocoa::base::id;
                unsafe {
                    use objc::{sel, sel_impl, class};
                    let _: () = objc::msg_send![ns_window, makeKeyAndOrderFront: cocoa::base::nil];
                    let ns_app: cocoa::base::id = objc::msg_send![class!(NSRunningApplication), currentApplication];
                    let _: bool = objc::msg_send![ns_app, activateWithOptions: 2];
                }
            });
        }
    }
}

#[tauri::command]
pub fn hide_notebook(app: AppHandle) {
    if let Some(window) = app.get_webview_window("notebook") {
        #[cfg(target_os = "macos")]
        {
            let ns_window_ptr = window.ns_window().unwrap() as usize;
            let _ = app.run_on_main_thread(move || {
                let ns_window = ns_window_ptr as cocoa::base::id;
                unsafe {
                    use objc::{sel, sel_impl};
                    let _: () = objc::msg_send![ns_window, orderOut: cocoa::base::nil];
                }
            });
        }
    }
}

#[tauri::command]
pub fn console_log(msg: String) {
    println!("[REACT CONSOLE] {}", msg);
}

#[tauri::command]
pub fn hide_panel(label: String, app: AppHandle) {
    println!("[RUST DEBUG] hide_panel called for label: {}", label);
    
    if label == "chat-panel" {
        #[cfg(target_os = "macos")]
        {
            if let (Some(main_win), Some(panel_win)) = (app.get_webview_window("main"), app.get_webview_window("chat-panel")) {
                let main_ns_win = main_win.ns_window().unwrap() as usize;
                let panel_ns_win = panel_win.ns_window().unwrap() as usize;
                let _ = app.run_on_main_thread(move || {
                    let main_ns_win = main_ns_win as cocoa::base::id;
                    let panel_ns_win = panel_ns_win as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl};
                        let parent: cocoa::base::id = objc::msg_send![panel_ns_win, parentWindow];
                        if parent == main_ns_win {
                            let _: () = objc::msg_send![main_ns_win, removeChildWindow: panel_ns_win];
                        }
                    }
                });
            }
        }
    }

    if label != "main" && label != "chat-panel" {
        show_panel("main".to_string(), app.clone());
        let _ = app.emit("sync-chat-panel", ());
    }
    if let Some(window) = app.get_webview_window(&label) {
        #[cfg(target_os = "macos")]
        {
            let is_main = label == "main";
            let ns_window_ptr = window.ns_window().unwrap() as usize;
            
            let _ = app.run_on_main_thread(move || {
                if is_main {
                    let ns_window = ns_window_ptr as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl};
                        let _: () = objc::msg_send![ns_window, setAlphaValue: 0.0f64];
                        let _: () = objc::msg_send![ns_window, setIgnoresMouseEvents: cocoa::base::YES];
                    }
                } else {
                    let ns_window = ns_window_ptr as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl};
                        let _: () = objc::msg_send![ns_window, orderOut: cocoa::base::nil];
                    }
                }
            });
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = window.hide();
        }
    }
}



#[tauri::command]
pub fn log_debug(code: String, message: String) {
    println!("[{}] {}", code, message);
}

#[tauri::command]
pub fn open_main_chat(app: AppHandle) {
    let mode = read_app_mode();
    if mode == "windowed" {
        if let Some(shell) = app.get_webview_window("app-shell") {
            let _ = shell.show();
            let _ = shell.set_focus();
            let _ = app.emit("set-active-surface", "chat");
        }
        return;
    }

    println!("[INFO-WIN-001] open_main_chat invoked");
    #[cfg(target_os = "macos")]
    {
        let mut aux_ptrs = Vec::new();
        for label in &["history", "notebook", "settings", "snip"] {
            if let Some(window) = app.get_webview_window(label) {
                if let Ok(ptr) = window.ns_window() {
                    aux_ptrs.push((label.to_string(), ptr as usize));
                } else {
                    println!("[ERR-WIN-001] Failed to get ns_window pointer for label: {}", label);
                }
            }
        }
        let main_ptr = app.get_webview_window("main").and_then(|w| w.ns_window().ok().map(|p| p as usize));
        if main_ptr.is_none() {
            println!("[ERR-WIN-002] Main window pointer NOT found!");
        }

        let _ = app.run_on_main_thread(move || {
            use objc::{class, sel, sel_impl};
            unsafe {
                // Order out all secondary auxiliary windows
                for (label, ptr) in aux_ptrs {
                    println!("[INFO-WIN-002] Ordering out auxiliary panel: {}", label);
                    let ns_window = ptr as cocoa::base::id;
                    let _: () = objc::msg_send![ns_window, orderOut: cocoa::base::nil];
                }

                // Make main chat overlay visible, mouse-interactive, and focused
                if let Some(ptr) = main_ptr {
                    println!("[INFO-WIN-003] Raising main window, alpha=1.0, ignoresMouse=NO, makeKeyAndOrderFront");
                    let ns_window = ptr as cocoa::base::id;
                    let _: () = objc::msg_send![ns_window, setAlphaValue: 1.0f64];
                    let _: () = objc::msg_send![ns_window, setIgnoresMouseEvents: cocoa::base::NO];
                    let _: () = objc::msg_send![ns_window, makeKeyAndOrderFront: cocoa::base::nil];

                    let ns_app: cocoa::base::id = objc::msg_send![class!(NSRunningApplication), currentApplication];
                    let _: bool = objc::msg_send![ns_app, activateWithOptions: 2];
                }
            }
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        for label in &["history", "notebook", "settings", "snip"] {
            if let Some(window) = app.get_webview_window(label) {
                let _ = window.hide();
            }
        }
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.show();
            let _ = main_win.set_focus();
        }
    }
}

#[tauri::command]
pub fn focus_panel(label: String, app: AppHandle) {
    if let Some(window) = app.get_webview_window(&label) {
        #[cfg(target_os = "macos")]
        {
            let ns_window_ptr = window.ns_window().unwrap() as usize;
            let _ = app.run_on_main_thread(move || {
                let ns_window = ns_window_ptr as cocoa::base::id;
                use objc::{sel, sel_impl};
                unsafe {
                    let _: () = objc::msg_send![ns_window, makeKeyWindow];
                }
            });
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
pub fn unfocus_panel(app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.run_on_main_thread(move || {
            use objc::{class, sel, sel_impl};
            unsafe {
                let workspace: cocoa::base::id = objc::msg_send![class!(NSWorkspace), sharedWorkspace];
                let front_app: cocoa::base::id = objc::msg_send![workspace, frontmostApplication];
                let options: cocoa::foundation::NSUInteger = 0;
                let _: bool = objc::msg_send![front_app, activateWithOptions: options];
                
                let ns_app: cocoa::base::id = objc::msg_send![class!(NSApplication), sharedApplication];
                let _: () = objc::msg_send![ns_app, deactivate];
            }
        });
    }
}

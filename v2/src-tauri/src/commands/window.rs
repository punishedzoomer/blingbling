use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn hide_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().unwrap_or_default();
    }
}

#[tauri::command]
pub fn quit_app(_app: AppHandle) {
    std::process::exit(0);
}

#[tauri::command]
pub fn resize_panel(label: String, width: f64, height: f64, app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        use objc::{sel, sel_impl};
        if let Some(window) = app.get_webview_window(&label) {
            let ns_window = window.ns_window().unwrap() as cocoa::base::id;
            unsafe {
                #[repr(C)]
                #[derive(Copy, Clone)]
                struct NSRect {
                    x: f64,
                    y: f64,
                    width: f64,
                    height: f64,
                }
                
                // Get current frame and content rect
                let frame: NSRect = objc::msg_send![ns_window, frame];
                let content_rect: NSRect = objc::msg_send![ns_window, contentRectForFrameRect:frame];
                
                let height_diff = height - content_rect.height;
                
                // Adjust origin.y to maintain top-left position (macOS origin is bottom-left)
                let new_content_rect = NSRect {
                    x: frame.x,
                    y: frame.y - height_diff,
                    width: width,
                    height: height,
                };
                
                let new_frame: NSRect = objc::msg_send![ns_window, frameRectForContentRect:new_content_rect];
                let _: () = objc::msg_send![ns_window, setFrame:new_frame display:1];
            }
        }
    }
}

#[tauri::command]
pub fn set_debug_mode(debug: bool, app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        use objc::{sel, sel_impl};
        let sharing_type: cocoa::foundation::NSUInteger = if debug { 1 } else { 0 };
        for window in app.webview_windows().values() {
            let ns_window = window.ns_window().unwrap() as cocoa::base::id;
            unsafe {
                let _: () = objc::msg_send![ns_window, setSharingType: sharing_type];
            }
        }
    }
}

#[tauri::command]
pub fn show_panel(label: String, app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        use tauri_nspanel::WebviewWindowExt;
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.center();
            if let Ok(panel) = window.to_panel() {
                panel.show();
                let ns_window = window.ns_window().unwrap() as cocoa::base::id;
                unsafe {
                    use objc::{sel, sel_impl, class};
                    let _: () = objc::msg_send![ns_window, makeKeyAndOrderFront: cocoa::base::nil];
                    let ns_app: cocoa::base::id = objc::msg_send![class!(NSApplication), sharedApplication];
                    let _: () = objc::msg_send![ns_app, activateIgnoringOtherApps: true];
                }
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window(&label) {
            window.show().unwrap();
            window.set_focus().unwrap();
        }
    }
}

#[tauri::command]
pub fn hide_panel(label: String, app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        use tauri_nspanel::WebviewWindowExt;
        if let Some(window) = app.get_webview_window(&label) {
            if let Ok(panel) = window.to_panel() {
                panel.order_out(None);
            } else {
                window.hide().unwrap();
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window(&label) {
            window.hide().unwrap();
        }
    }
}

#[tauri::command]
pub fn focus_panel(label: String, app: AppHandle) {
    if let Some(window) = app.get_webview_window(&label) {
        #[cfg(target_os = "macos")]
        {
            use objc::{sel, sel_impl};
            let ns_window = window.ns_window().unwrap() as cocoa::base::id;
            unsafe {
                let _: () = objc::msg_send![ns_window, makeKeyWindow];
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            window.set_focus().unwrap_or_default();
        }
    }
}

#[tauri::command]
pub fn unfocus_panel(_app: AppHandle) {
    #[cfg(target_os = "macos")]
    {
        use objc::{class, sel, sel_impl};
        unsafe {
            // Give focus back to the previous app
            let workspace: cocoa::base::id = objc::msg_send![class!(NSWorkspace), sharedWorkspace];
            let front_app: cocoa::base::id = objc::msg_send![workspace, frontmostApplication];
            let _: bool = objc::msg_send![front_app, activateWithOptions:0];
            
            // Fallback
            let ns_app: cocoa::base::id = objc::msg_send![class!(NSApplication), sharedApplication];
            let _: () = objc::msg_send![ns_app, deactivate];
        }
    }
}

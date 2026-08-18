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
    if let Some(window) = app.get_webview_window(&label) {
        #[cfg(target_os = "macos")]
        {
            let is_main = label == "main";
            let ns_window_ptr = window.ns_window().unwrap() as usize;
            
            let _ = app.run_on_main_thread(move || {
                if is_main {
                    let ns_window = ns_window_ptr as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl, class};
                        let _: () = objc::msg_send![ns_window, setAlphaValue: 1.0f64];
                        let _: () = objc::msg_send![ns_window, setIgnoresMouseEvents: cocoa::base::NO];
                        
                        let ns_app: cocoa::base::id = objc::msg_send![class!(NSRunningApplication), currentApplication];
                        let _: bool = objc::msg_send![ns_app, activateWithOptions: 2];
                    }
                } else {
                    use tauri_nspanel::WebviewWindowExt;
                    if let Ok(panel) = window.to_panel() {
                        panel.show();
                        let ns_window = ns_window_ptr as cocoa::base::id;
                        unsafe {
                            use objc::{sel, sel_impl, class};
                            let _: () = objc::msg_send![ns_window, makeKeyAndOrderFront: cocoa::base::nil];
                            let ns_app: cocoa::base::id = objc::msg_send![class!(NSRunningApplication), currentApplication];
                            let _: bool = objc::msg_send![ns_app, activateWithOptions: 2];
                        }
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
        }
    }
}

#[tauri::command]
pub fn hide_panel(label: String, app: AppHandle) {
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
                    let _ = window.hide();
                }
            });
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
            window.set_focus().unwrap_or_default();
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

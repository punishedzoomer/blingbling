#![allow(deprecated)]
#![allow(unexpected_cfgs)]

mod commands;
mod websocket;

use tauri::Manager;
use std::sync::atomic::AtomicBool;

pub struct AiState {
    pub cancel_flag: AtomicBool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_nspanel::init())
        .manage(AiState { cancel_flag: AtomicBool::new(false) })

        .invoke_handler(tauri::generate_handler![
            commands::screen::capture_screen, 
            commands::screen::capture_screen_interactive,
            commands::ai::stream_ai_response,
            commands::ai::cancel_ai_response,
            commands::ai::generate_title,
            commands::session::save_session,
            commands::session::delete_session,
            commands::session::load_sessions,
            commands::session::load_trash,
            commands::session::restore_session,
            commands::session::permanently_delete_session,
            commands::session::empty_trash,
            commands::window::console_log,
            commands::window::hide_window,
            commands::window::quit_app,
            commands::window::set_debug_mode,
            commands::window::show_panel,
            commands::window::hide_panel,
            commands::window::show_notebook,
            commands::window::hide_notebook,
            commands::window::resize_panel,
            commands::window::focus_panel,
            commands::window::unfocus_panel,
            commands::window::open_main_chat,
            commands::window::log_debug,
            commands::window::get_app_mode,
            commands::window::set_app_mode,
            commands::file::pick_files
        ])
        .setup(|app| {
            let ws_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                websocket::start_server(ws_handle).await;
            });

            let initial_mode = commands::window::read_app_mode();
            
            #[cfg(target_os = "macos")]
            {
                use objc::{sel, sel_impl};
                use tauri_nspanel::WebviewWindowExt;
                
                if let Some(shell) = app.get_webview_window("app-shell") {
                    if let Ok(ns_win_ptr) = shell.ns_window() {
                        let ns_window = ns_win_ptr as cocoa::base::id;
                        unsafe {
                            // NSWindowTitleHidden = 1 (Hide native macOS title text in overlay title bar)
                            let _: () = objc::msg_send![ns_window, setTitleVisibility: 1];
                            let _: () = objc::msg_send![ns_window, setTitlebarAppearsTransparent: true];
                            let clear_color: cocoa::base::id = objc::msg_send![objc::class!(NSColor), clearColor];
                            let _: () = objc::msg_send![ns_window, setBackgroundColor: clear_color];
                            let _: () = objc::msg_send![ns_window, setOpaque: cocoa::base::NO];
                        }
                    }
                    if initial_mode == "windowed" {
                        let _ = shell.show();
                        let _ = shell.set_focus();
                    } else {
                        let _ = shell.hide();
                    }
                }
                
                if initial_mode == "windowed" {
                    app.set_activation_policy(tauri::ActivationPolicy::Regular);
                } else {
                    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
                
                // Swizzle all auxiliary/main windows into NSPanels on main thread, skipping app-shell
                for (label, window) in app.webview_windows() {
                    if label == "app-shell" {
                        continue;
                    }

                    if let Ok(panel) = window.to_panel() {
                        let behavior = cocoa::appkit::NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces |
                                       cocoa::appkit::NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary |
                                       cocoa::appkit::NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary;
                        
                        panel.set_collection_behaviour(behavior);
                        panel.set_level(1000); // NSScreenSaverWindowLevel
                        
                        if let Ok(ns_win_ptr) = window.ns_window() {
                            let ns_window = ns_win_ptr as cocoa::base::id;
                            unsafe {
                                let _: () = objc::msg_send![ns_window, setSharingType: 0];
                                let _: () = objc::msg_send![ns_window, setAcceptsMouseMovedEvents:true];
                                let style_mask: cocoa::foundation::NSUInteger = objc::msg_send![ns_window, styleMask];
                                let _: () = objc::msg_send![ns_window, setStyleMask: style_mask | 128];
                                let clear_color: cocoa::base::id = objc::msg_send![objc::class!(NSColor), clearColor];
                                let _: () = objc::msg_send![ns_window, setBackgroundColor: clear_color];
                                let _: () = objc::msg_send![ns_window, setOpaque: cocoa::base::NO];
                            }
                        }

                        // Only show the main panel by default when in widget mode
                        if label == "main" && initial_mode != "windowed" {
                            panel.show();
                        }
                    }
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                if initial_mode == "windowed" {
                    if let Some(shell) = app.get_webview_window("app-shell") {
                        shell.show().unwrap();
                    }
                } else if let Some(window) = app.get_webview_window("main") {
                    window.show().unwrap();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            #[cfg(not(target_os = "macos"))]
            tauri::WindowEvent::Moved(pos) => {
                if window.label() == "main" {
                    if let Some(chat_win) = window.app_handle().get_webview_window("chat-panel") {
                        if let (Ok(size), Ok(psize)) = (window.outer_size(), chat_win.outer_size()) {
                            let offset_x = (psize.width as i32 - size.width as i32) / 2;
                            let scale_factor = window.scale_factor().unwrap_or(1.0);
                            let gap = (6.0 * scale_factor) as i32;
                            let _ = chat_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                                x: pos.x - offset_x,
                                y: pos.y + size.height as i32 + gap,
                            }));
                        }
                    }
                }
            }
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "app-shell" || window.label() == "main" {
                    std::process::exit(0);
                } else {
                    api.prevent_close();
                    #[cfg(target_os = "macos")]
                    {
                        use tauri_nspanel::ManagerExt;
                        if let Ok(panel) = window.app_handle().get_webview_panel(window.label()) {
                            panel.order_out(None);
                        }
                    }
                    #[cfg(not(target_os = "macos"))]
                    {
                        let _ = window.hide();
                    }
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {});
}

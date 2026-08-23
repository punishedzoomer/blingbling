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
                
                if initial_mode == "windowed" {
                    app.set_activation_policy(tauri::ActivationPolicy::Regular);
                    if let Some(shell) = app.get_webview_window("app-shell") {
                        let _ = shell.show();
                        let _ = shell.set_focus();
                    }
                } else {
                    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                    if let Some(shell) = app.get_webview_window("app-shell") {
                        let _ = shell.hide();
                    }
                }
                
                let app_handle = app.handle().clone();
                let is_windowed = initial_mode == "windowed";
                
                let swizzle_panels = move || {
                    for (label, window) in app_handle.webview_windows() {
                        if label == "app-shell" {
                            continue;
                        }

                        if let Ok(panel) = window.to_panel() {
                            let behavior = cocoa::appkit::NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces |
                                           cocoa::appkit::NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary |
                                           cocoa::appkit::NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary;
                            
                            panel.set_collection_behaviour(behavior);
                            panel.set_level(1000); // NSScreenSaverWindowLevel
                            
                            let ns_window = window.ns_window().unwrap() as cocoa::base::id;
                            unsafe {
                                let _: () = objc::msg_send![ns_window, setSharingType: 0];
                                let _: () = objc::msg_send![ns_window, setAcceptsMouseMovedEvents:true];
                                let style_mask: cocoa::foundation::NSUInteger = objc::msg_send![ns_window, styleMask];
                                let _: () = objc::msg_send![ns_window, setStyleMask: style_mask | 128];
                                let clear_color: cocoa::base::id = objc::msg_send![objc::class!(NSColor), clearColor];
                                let _: () = objc::msg_send![ns_window, setBackgroundColor: clear_color];
                                let _: () = objc::msg_send![ns_window, setOpaque: cocoa::base::NO];
                            }

                            // Only show the main panel by default when in widget mode
                            if label == "main" && !is_windowed {
                                panel.show();
                            }
                        }
                    }
                };

                if is_windowed {
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                        swizzle_panels();
                    });
                } else {
                    swizzle_panels();
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
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "app-shell" || window.label() == "main" {
                    std::process::exit(0);
                } else {
                    api.prevent_close();
                    #[cfg(target_os = "macos")]
                    {
                        if let Some(webview_window) = window.app_handle().get_webview_window(window.label()) {
                            use tauri_nspanel::WebviewWindowExt;
                            if let Ok(panel) = webview_window.to_panel() {
                                panel.order_out(None);
                            }
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
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}

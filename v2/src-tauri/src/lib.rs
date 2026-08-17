#![allow(deprecated)]
#![allow(unexpected_cfgs)]

mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_nspanel::init())
        .invoke_handler(tauri::generate_handler![
            commands::screen::capture_screen, 
            commands::screen::start_interactive_snip,
            commands::screen::process_snip,
            commands::ai::stream_ai_response,
            commands::session::save_session,
            commands::session::load_sessions,
            commands::window::hide_window,
            commands::window::quit_app,
            commands::window::set_debug_mode,
            commands::window::show_panel,
            commands::window::hide_panel,
            commands::window::resize_panel,
            commands::window::focus_panel,
            commands::window::unfocus_panel
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use objc::{sel, sel_impl};

                use tauri_nspanel::WebviewWindowExt;
                
                // 1. Make app act as an accessory
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                
                // Swizzle all windows into NSPanels
                for window in app.webview_windows().values() {
                    let panel = window.to_panel().unwrap();
                    
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
                    }

                    // Only show the main panel by default
                    if window.label() == "main" {
                        panel.show();
                    }
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.show().unwrap();
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}

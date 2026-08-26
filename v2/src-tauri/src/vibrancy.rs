#[cfg(target_os = "macos")]
pub fn apply_vibrancy(window: &tauri::WebviewWindow, corner_radius: f64) {
    use cocoa::base::{id, nil, YES};
    use objc::{class, msg_send, sel, sel_impl};

    if let Ok(ns_win_ptr) = window.ns_window() {
        let ns_window = ns_win_ptr as id;
        unsafe {
            let content_view: id = msg_send![ns_window, contentView];
            if content_view != nil {
                let bounds: cocoa::foundation::NSRect = msg_send![content_view, bounds];

                // Allocate and initialize NSVisualEffectView
                let effect_view: id = msg_send![class!(NSVisualEffectView), alloc];
                let effect_view: id = msg_send![effect_view, initWithFrame: bounds];

                // Autoresizing: NSViewWidthSizable (2) | NSViewHeightSizable (16)
                let autoresizing_mask: usize = 2 | 16;
                let _: () = msg_send![effect_view, setAutoresizingMask: autoresizing_mask];

                // Material: NSVisualEffectMaterialHUDWindow (13) - dark, refined native macOS glass
                let material: isize = 13;
                let _: () = msg_send![effect_view, setMaterial: material];

                // Blending Mode: NSVisualEffectBlendingModeBehindWindow (0)
                let blending_mode: isize = 0;
                let _: () = msg_send![effect_view, setBlendingMode: blending_mode];

                // State: NSVisualEffectStateActive (1) - active even when inactive/blurred
                let state: isize = 1;
                let _: () = msg_send![effect_view, setState: state];

                // Apply rounded corners to the native visual effect layer
                if corner_radius > 0.0 {
                    let _: () = msg_send![effect_view, setWantsLayer: YES];
                    let layer: id = msg_send![effect_view, layer];
                    if layer != nil {
                        let _: () = msg_send![layer, setCornerRadius: corner_radius];
                        let _: () = msg_send![layer, setMasksToBounds: YES];
                    }
                }

                // Add below the webview: NSWindowBelow (-1)
                let _: () = msg_send![content_view, addSubview: effect_view positioned: -1isize relativeTo: nil];
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn apply_vibrancy(_window: &tauri::WebviewWindow, _corner_radius: f64) {
    // No-op on non-macOS platforms
}

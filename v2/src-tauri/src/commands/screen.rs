use xcap::Monitor;
use base64::prelude::*;
use std::io::Cursor;
use image::ImageFormat;

#[tauri::command]
pub fn capture_screen(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();
    
    let _ = app.run_on_main_thread(move || {
        let result = (|| -> Result<String, String> {
            use xcap::Monitor;
            let monitors = Monitor::all().map_err(|e| e.to_string())?;
            let monitor = monitors.first().ok_or("No monitor found")?;
            
            let raw_image = monitor.capture_image().map_err(|e| e.to_string())?;
            
            let max_width = 1920;
            let (width, height) = image::GenericImageView::dimensions(&raw_image);
            
            let dynamic_img = if width > max_width {
                let ratio = max_width as f32 / width as f32;
                let new_height = (height as f32 * ratio) as u32;
                let resized = image::imageops::thumbnail(&raw_image, max_width, new_height);
                image::DynamicImage::ImageRgba8(resized)
            } else {
                image::DynamicImage::ImageRgba8(raw_image)
            };
            
            use std::io::Cursor;
            use image::ImageFormat;
            use base64::prelude::*;
            
            let mut buffer = Cursor::new(Vec::new());
            dynamic_img.write_to(&mut buffer, ImageFormat::Jpeg).map_err(|e| e.to_string())?;
            
            let base64_img = BASE64_STANDARD.encode(buffer.into_inner());
            Ok(format!("data:image/jpeg;base64,{}", base64_img))
        })();
        let _ = tx.send(result);
    });
    
    rx.recv().map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn start_interactive_snip(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        use tauri_nspanel::WebviewWindowExt;
        
        if let Some(window) = app.get_webview_window("snip") {
            let monitor = window.primary_monitor().map_err(|e| e.to_string())?.ok_or("No monitor found")?;
            let size = monitor.size();
            let pos = monitor.position();
            
            window.set_size(*size).unwrap();
            window.set_position(*pos).unwrap();
            
            if let Ok(panel) = window.to_panel() {
                let ns_window_ptr = window.ns_window().unwrap() as usize;
                let _ = app.run_on_main_thread(move || {
                    panel.show();
                    let ns_window = ns_window_ptr as cocoa::base::id;
                    unsafe {
                        use objc::{sel, sel_impl};
                        let _: () = objc::msg_send![ns_window, makeKeyAndOrderFront: cocoa::base::nil];
                    }
                });
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn process_snip(x: f32, y: f32, width: f32, height: f32, app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();
    
    let scale_factor = app.primary_monitor().map_err(|e| e.to_string())?.ok_or("No monitor found")?.scale_factor();
    
    let _ = app.run_on_main_thread(move || {
        let result = (|| -> Result<String, String> {
            use xcap::Monitor;
            let monitors = Monitor::all().map_err(|e| e.to_string())?;
            let monitor = monitors.first().ok_or("No monitor found")?;
            
            let mut x_phys = (x * scale_factor as f32).round() as u32;
            let mut y_phys = (y * scale_factor as f32).round() as u32;
            let mut w_phys = (width * scale_factor as f32).round() as u32;
            let mut h_phys = (height * scale_factor as f32).round() as u32;
            
            let mut raw_image = monitor.capture_image().map_err(|e| e.to_string())?;
            
            let img_w = raw_image.width();
            let img_h = raw_image.height();
            
            if x_phys >= img_w { x_phys = img_w.saturating_sub(1); }
            if y_phys >= img_h { y_phys = img_h.saturating_sub(1); }
            if x_phys + w_phys > img_w { w_phys = img_w - x_phys; }
            if y_phys + h_phys > img_h { h_phys = img_h - y_phys; }
            
            if w_phys == 0 || h_phys == 0 {
                return Err("Invalid selection area".into());
            }
            
            let cropped = image::imageops::crop(&mut raw_image, x_phys, y_phys, w_phys, h_phys).to_image();
            
            let max_width = 1920;
            let (c_w, c_h) = cropped.dimensions();
            
            let dynamic_img = if c_w > max_width {
                let ratio = max_width as f32 / c_w as f32;
                let new_height = (c_h as f32 * ratio) as u32;
                let resized = image::imageops::thumbnail(&cropped, max_width, new_height);
                image::DynamicImage::ImageRgba8(resized)
            } else {
                image::DynamicImage::ImageRgba8(cropped)
            };
            
            use std::io::Cursor;
            use image::ImageFormat;
            use base64::prelude::*;
            
            let mut buffer = Cursor::new(Vec::new());
            dynamic_img.write_to(&mut buffer, ImageFormat::Jpeg).map_err(|e| e.to_string())?;
            
            let base64_img = BASE64_STANDARD.encode(buffer.into_inner());
            Ok(format!("data:image/jpeg;base64,{}", base64_img))
        })();
        let _ = tx.send(result);
    });
    
    rx.recv().map_err(|e| e.to_string())?
}

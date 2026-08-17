use xcap::Monitor;
use base64::prelude::*;
use std::io::Cursor;
use image::ImageFormat;

#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
    // Get the primary monitor
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors.first().ok_or("No monitor found")?;
    
    // Capture the screen (returns RgbaImage)
    let raw_image = monitor.capture_image().map_err(|e| e.to_string())?;
    
    // Calculate new dimensions (max width 1920 to keep it fast and light)
    let max_width = 1920;
    let (width, height) = raw_image.dimensions();
    
    let dynamic_img = if width > max_width {
        let ratio = max_width as f32 / width as f32;
        let new_height = (height as f32 * ratio) as u32;
        
        // thumbnail is heavily optimized for fast downscaling
        let resized = image::imageops::thumbnail(&raw_image, max_width, new_height);
        image::DynamicImage::ImageRgba8(resized)
    } else {
        image::DynamicImage::ImageRgba8(raw_image.clone())
    };
    
    // Convert to JPEG and encode to base64
    let mut buffer = Cursor::new(Vec::new());
    // DynamicImage has write_to
    dynamic_img.write_to(&mut buffer, ImageFormat::Jpeg).map_err(|e| e.to_string())?;
    
    let base64_img = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/jpeg;base64,{}", base64_img))
}

#[tauri::command]
pub fn start_interactive_snip(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        use tauri_nspanel::WebviewWindowExt;
        
        if let Some(window) = app.get_webview_window("snip") {
            let monitor = window.primary_monitor().unwrap().unwrap();
            let size = monitor.size();
            let pos = monitor.position();
            
            window.set_size(*size).unwrap();
            window.set_position(*pos).unwrap();
            
            if let Ok(panel) = window.to_panel() {
                panel.show();
                let ns_window = window.ns_window().unwrap() as cocoa::base::id;
                unsafe {
                    use objc::{sel, sel_impl};
                    let _: () = objc::msg_send![ns_window, makeKeyAndOrderFront: cocoa::base::nil];
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn process_snip(x: f32, y: f32, width: f32, height: f32, app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors.first().ok_or("No monitor found")?;
    
    let scale_factor = app.primary_monitor().unwrap().unwrap().scale_factor();
    
    let x_phys = (x * scale_factor as f32).round() as u32;
    let y_phys = (y * scale_factor as f32).round() as u32;
    let w_phys = (width * scale_factor as f32).round() as u32;
    let h_phys = (height * scale_factor as f32).round() as u32;
    
    let mut raw_image = monitor.capture_image().map_err(|e| e.to_string())?;
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
    
    let mut buffer = Cursor::new(Vec::new());
    dynamic_img.write_to(&mut buffer, ImageFormat::Jpeg).map_err(|e| e.to_string())?;
    
    let base64_img = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/jpeg;base64,{}", base64_img))
}

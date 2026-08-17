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
pub fn capture_screen_interactive() -> Result<String, String> {
    let temp_path = std::env::temp_dir().join("crackit_snip.png");
    
    // Use macOS native interactive screen capture
    let mut cmd = std::process::Command::new("screencapture");
    // -i: interactive mode
    // -x: do not play sounds
    cmd.arg("-i").arg("-x").arg(&temp_path);
    
    let status = cmd.status().map_err(|e| e.to_string())?;
    
    if !status.success() || !temp_path.exists() {
        return Err("Capture cancelled or failed".into());
    }
    
    // Read the image
    let raw_image = image::open(&temp_path).map_err(|e| e.to_string())?;
    
    // Clean up temp file immediately
    let _ = std::fs::remove_file(&temp_path);
    
    // Downscale if needed
    let max_width = 1920;
    let (width, height) = image::GenericImageView::dimensions(&raw_image);
    
    let dynamic_img = if width > max_width {
        let ratio = max_width as f32 / width as f32;
        let new_height = (height as f32 * ratio) as u32;
        
        let resized = image::imageops::thumbnail(&raw_image.to_rgba8(), max_width, new_height);
        image::DynamicImage::ImageRgba8(resized)
    } else {
        raw_image
    };
    
    // Convert to JPEG and encode to base64
    let mut buffer = Cursor::new(Vec::new());
    dynamic_img.write_to(&mut buffer, ImageFormat::Jpeg).map_err(|e| e.to_string())?;
    
    let base64_img = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/jpeg;base64,{}", base64_img))
}

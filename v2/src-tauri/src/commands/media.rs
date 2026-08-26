use std::path::PathBuf;

fn decode_percent(input: &str) -> String {
    let mut out = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&input[i + 1..i + 3], 16) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

async fn resolve_image_file_path(src: &str) -> Result<PathBuf, String> {
    let clean_src = src.trim();

    // 1. If it's a data URI, cache it to disk first and return the path
    if clean_src.starts_with("data:image/") {
        if let Some(path_str) = crate::commands::session::cache_base64_image(clean_src) {
            let path = PathBuf::from(&path_str);
            if path.exists() {
                return Ok(path);
            }
        }
    }

    // 2. If it's a local asset or file path
    let mut path_str = clean_src;
    if path_str.starts_with("asset://localhost/") {
        path_str = &path_str["asset://localhost".len()..];
    } else if path_str.starts_with("asset://localhost") {
        path_str = &path_str["asset://localhost".len()..];
    } else if path_str.starts_with("asset:/") {
        path_str = &path_str["asset:".len()..];
    } else if path_str.starts_with("file://") {
        path_str = &path_str["file://".len()..];
    }

    let decoded_path = decode_percent(path_str);
    let path = PathBuf::from(&decoded_path);
    if path.exists() {
        return Ok(path);
    }

    // 3. If it's a remote URL, download to a cached temp file
    if clean_src.starts_with("http://") || clean_src.starts_with("https://") {
        let res = reqwest::get(clean_src).await.map_err(|e| e.to_string())?;
        let bytes = res.bytes().await.map_err(|e| e.to_string())?;
        let media_dir = crate::commands::session::get_media_dir();
        let temp_path = media_dir.join(format!("download_{}.png", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        std::fs::write(&temp_path, &bytes).map_err(|e| e.to_string())?;
        return Ok(temp_path);
    }

    Err(format!("Image file could not be resolved: {}", clean_src))
}

#[cfg(target_os = "macos")]
fn show_save_panel(default_name: &str) -> Option<PathBuf> {
    let script = format!(
        r#"
        try
            set chosenFile to (choose file name default name "{}" with prompt "Save Image As:")
            return POSIX path of chosenFile
        on error
            return ""
        end try
        "#,
        default_name.replace('\\', "\\\\").replace('"', "\\\"")
    );

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let path_str = stdout.trim();
        if !path_str.is_empty() {
            let mut pb = PathBuf::from(path_str);
            if pb.extension().is_none() {
                pb.set_extension("png");
            }
            return Some(pb);
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn show_save_panel(_default_name: &str) -> Option<PathBuf> {
    None
}

#[cfg(target_os = "macos")]
fn copy_image_to_system_clipboard(path: &std::path::Path) -> Result<(), String> {
    let script = format!(
        r#"
        try
            set the clipboard to (read (POSIX file "{}") as «class PNGf»)
            return "ok"
        on error errStr
            return errStr
        end try
        "#,
        path.to_string_lossy().replace('\\', "\\\\").replace('"', "\\\"")
    );

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let res = String::from_utf8_lossy(&output.stdout);
        if res.trim() == "ok" {
            return Ok(());
        }
    }
    Err("Failed to copy image to macOS clipboard".to_string())
}

#[cfg(not(target_os = "macos"))]
fn copy_image_to_system_clipboard(_path: &std::path::Path) -> Result<(), String> {
    Err("Pasteboard only supported on macOS".to_string())
}

#[tauri::command]
pub async fn save_image_dialog(src: String, default_filename: Option<String>) -> Result<bool, String> {
    let file_path = resolve_image_file_path(&src).await?;
    let raw_name = default_filename.unwrap_or_else(|| "generated-image.png".to_string());
    let filename = if raw_name.ends_with(".png") || raw_name.ends_with(".jpg") || raw_name.ends_with(".webp") {
        raw_name
    } else {
        format!("{}.png", raw_name)
    };

    // Run blocking dialog on a background worker thread
    let result = tokio::task::spawn_blocking(move || -> Result<bool, String> {
        if let Some(target_path) = show_save_panel(&filename) {
            std::fs::copy(&file_path, &target_path).map_err(|e| e.to_string())?;
            Ok(true)
        } else {
            Ok(false) // User clicked Cancel
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

#[tauri::command]
pub async fn copy_image_to_clipboard(src: String) -> Result<(), String> {
    let file_path = resolve_image_file_path(&src).await?;
    tokio::task::spawn_blocking(move || {
        copy_image_to_system_clipboard(&file_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

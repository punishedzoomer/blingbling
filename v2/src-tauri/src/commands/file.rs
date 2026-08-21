use tauri::AppHandle;
use serde::{Serialize, Deserialize};
use std::path::Path;
use base64::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PickedAttachment {
    pub id: String,
    pub name: String,
    pub r#type: String, // "image" | "file"
    pub mime_type: String,
    pub size: u64,
    pub content: String,
    pub preview_url: Option<String>,
}

fn is_image_ext(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "bmp" | "ico")
}

#[tauri::command]
pub async fn pick_files(app: AppHandle) -> Result<Vec<PickedAttachment>, String> {
    // 1. Hide the main window before opening file picker
    crate::commands::window::hide_panel("main".to_string(), app.clone());

    // Small delay to ensure macOS window server completes orderOut/alpha animation
    tokio::time::sleep(tokio::time::Duration::from_millis(80)).await;

    let app_clone = app.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<PickedAttachment>, String> {
        #[cfg(target_os = "macos")]
        {
            let script = r#"
                set fileList to choose file with prompt "Select files to attach" with multiple selections allowed
                set posixList to {}
                repeat with f in fileList
                    set end of posixList to POSIX path of f
                end repeat
                set AppleScript's text item delimiters to linefeed
                return posixList as text
            "#;

            let output = std::process::Command::new("osascript")
                .arg("-e")
                .arg(script)
                .output();

            let mut attachments = Vec::new();

            if let Ok(out) = output {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    for line in stdout.lines() {
                        let trimmed = line.trim();
                        if trimmed.is_empty() { continue; }
                        let path = Path::new(trimmed);
                        if !path.exists() || !path.is_file() { continue; }

                        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file").to_string();
                        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                        let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                        let id = format!("{}-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis(), rand_id());

                        if is_image_ext(&ext) {
                            if let Ok(bytes) = std::fs::read(path) {
                                let mime = match ext.as_str() {
                                    "png" => "image/png",
                                    "jpg" | "jpeg" => "image/jpeg",
                                    "webp" => "image/webp",
                                    "gif" => "image/gif",
                                    "svg" => "image/svg+xml",
                                    _ => "image/png",
                                };
                                let b64 = BASE64_STANDARD.encode(bytes);
                                let data_url = format!("data:{};base64,{}", mime, b64);
                                attachments.push(PickedAttachment {
                                    id,
                                    name,
                                    r#type: "image".to_string(),
                                    mime_type: mime.to_string(),
                                    size,
                                    content: data_url.clone(),
                                    preview_url: Some(data_url),
                                });
                            }
                        } else {
                            // Read text / markdown / code / pdf
                            if let Ok(content_str) = std::fs::read_to_string(path) {
                                let mime = match ext.as_str() {
                                    "md" | "markdown" => "text/markdown",
                                    "json" => "application/json",
                                    "pdf" => "application/pdf",
                                    _ => "text/plain",
                                };
                                attachments.push(PickedAttachment {
                                    id,
                                    name,
                                    r#type: "file".to_string(),
                                    mime_type: mime.to_string(),
                                    size,
                                    content: content_str,
                                    preview_url: None,
                                });
                            } else if let Ok(bytes) = std::fs::read(path) {
                                let content_lossy = String::from_utf8_lossy(&bytes).to_string();
                                attachments.push(PickedAttachment {
                                    id,
                                    name,
                                    r#type: "file".to_string(),
                                    mime_type: if ext == "pdf" { "application/pdf".to_string() } else { "text/plain".to_string() },
                                    size,
                                    content: content_lossy,
                                    preview_url: None,
                                });
                            }
                        }
                    }
                }
            }

            Ok(attachments)
        }

        #[cfg(not(target_os = "macos"))]
        {
            Ok(Vec::new())
        }
    }).await.map_err(|e| e.to_string())??;

    // 2. Always restore the main window after file picking finishes (or cancels)
    crate::commands::window::show_panel("main".to_string(), app_clone);

    Ok(result)
}

fn rand_id() -> String {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    format!("{:x}", now % 1000000007)
}

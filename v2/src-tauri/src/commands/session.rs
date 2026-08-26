use std::fs;
use std::path::PathBuf;
use directories::ProjectDirs;
use serde_json::Value;
use base64::prelude::*;

pub fn get_sessions_dir() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("", "", "BlingBling") {
        let dir = proj_dirs.data_dir().join("sessions");
        fs::create_dir_all(&dir).unwrap_or_default();
        dir
    } else {
        let dir = std::env::current_dir().unwrap().join("sessions");
        fs::create_dir_all(&dir).unwrap_or_default();
        dir
    }
}

pub fn get_trash_dir() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("", "", "BlingBling") {
        let dir = proj_dirs.data_dir().join("trash");
        fs::create_dir_all(&dir).unwrap_or_default();
        dir
    } else {
        let dir = std::env::current_dir().unwrap().join("trash");
        fs::create_dir_all(&dir).unwrap_or_default();
        dir
    }
}

pub fn get_media_dir() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("", "", "BlingBling") {
        let dir = proj_dirs.data_dir().join("media");
        fs::create_dir_all(&dir).unwrap_or_default();
        dir
    } else {
        let dir = std::env::current_dir().unwrap().join("media");
        fs::create_dir_all(&dir).unwrap_or_default();
        dir
    }
}

/// Extracts any base64 image strings (data:image/...;base64,...), writes them to disk in media/,
/// and returns the absolute local file path
pub fn cache_base64_image(data_uri: &str) -> Option<String> {
    if !data_uri.starts_with("data:image/") {
        return None;
    }

    let comma_pos = data_uri.find(',')?;
    let header = &data_uri[..comma_pos];
    let b64_payload = &data_uri[comma_pos + 1..];

    let ext = if header.contains("png") {
        "png"
    } else if header.contains("webp") {
        "webp"
    } else if header.contains("jpeg") || header.contains("jpg") {
        "jpg"
    } else if header.contains("gif") {
        "gif"
    } else {
        "png"
    };

    let decoded_bytes = BASE64_STANDARD.decode(b64_payload.trim()).ok()?;

    // Use a fast hash to name the file deterministically (avoids duplicate disk writes)
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(&decoded_bytes, &mut hasher);
    let hash = std::hash::Hasher::finish(&hasher);

    let filename = format!("img_{:016x}.{}", hash, ext);
    let media_dir = get_media_dir();
    let file_path = media_dir.join(&filename);

    if !file_path.exists() {
        let _ = fs::write(&file_path, &decoded_bytes);
    }

    // Return the absolute local file path
    Some(file_path.to_string_lossy().to_string())
}

/// Recursively traverses a JSON Value, replacing any massive base64 image strings with clean file paths
pub fn sanitize_and_cache_json_media(val: &mut Value) -> bool {
    let mut changed = false;
    match val {
        Value::String(s) => {
            if s.contains("data:image/") {
                // Check if string contains markdown image with base64: ![...](data:image/...;base64,...)
                if let Some(start) = s.find("](data:image/") {
                    if let Some(end) = s[start + 2..].find(')') {
                        let data_uri = &s[start + 2..start + 2 + end];
                        if let Some(file_path) = cache_base64_image(data_uri) {
                            let new_str = format!("{}{}{}", &s[..start + 2], file_path, &s[start + 2 + end..]);
                            *s = new_str;
                            changed = true;
                        }
                    }
                } else if s.starts_with("data:image/") {
                    if let Some(file_path) = cache_base64_image(s) {
                        *s = file_path;
                        changed = true;
                    }
                }
            }
        }
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                if sanitize_and_cache_json_media(item) {
                    changed = true;
                }
            }
        }
        Value::Object(obj) => {
            for (_k, v) in obj.iter_mut() {
                if sanitize_and_cache_json_media(v) {
                    changed = true;
                }
            }
        }
        _ => {}
    }
    changed
}

#[tauri::command]
pub fn save_session(session_id: String, mut data: Value) -> Result<(), String> {
    // Automatically cache any base64 images to real binary files on disk
    sanitize_and_cache_json_media(&mut data);

    let file_path = get_sessions_dir().join(format!("{}.json", session_id));
    let file = fs::File::create(file_path).map_err(|e| e.to_string())?;
    let writer = std::io::BufWriter::new(file);
    serde_json::to_writer(writer, &data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_sessions() -> Result<Vec<Value>, String> {
    let mut sessions = Vec::new();
    let dir = get_sessions_dir();
    
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(file) = fs::File::open(&path) {
                        let reader = std::io::BufReader::new(file);
                        if let Ok(mut json) = serde_json::from_reader::<_, Value>(reader) {
                            // If this session has un-migrated base64 data, migrate it and save back
                            if sanitize_and_cache_json_media(&mut json) {
                                if let Ok(save_file) = fs::File::create(&path) {
                                    let writer = std::io::BufWriter::new(save_file);
                                    let _ = serde_json::to_writer(writer, &json);
                                }
                            }
                            sessions.push(serde_json::json!({
                                "id": file_stem,
                                "data": json
                            }));
                        }
                    }
                }
            }
        }
    }
    
    Ok(sessions)
}

#[tauri::command]
pub fn delete_session(session_id: String) -> Result<(), String> {
    let src_path = get_sessions_dir().join(format!("{}.json", session_id));
    let trash_dir = get_trash_dir();
    let dest_path = trash_dir.join(format!("{}.json", session_id));

    if src_path.exists() {
        if fs::rename(&src_path, &dest_path).is_err() {
            // Fallback: copy and remove
            fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&src_path);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn load_trash() -> Result<Vec<Value>, String> {
    let mut trash_items = Vec::new();
    let dir = get_trash_dir();
    
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(file) = fs::File::open(&path) {
                        let reader = std::io::BufReader::new(file);
                        if let Ok(mut json) = serde_json::from_reader::<_, Value>(reader) {
                            if sanitize_and_cache_json_media(&mut json) {
                                if let Ok(save_file) = fs::File::create(&path) {
                                    let writer = std::io::BufWriter::new(save_file);
                                    let _ = serde_json::to_writer(writer, &json);
                                }
                            }
                            trash_items.push(serde_json::json!({
                                "id": file_stem,
                                "data": json
                            }));
                        }
                    }
                }
            }
        }
    }
    
    Ok(trash_items)
}

#[tauri::command]
pub fn restore_session(session_id: String) -> Result<(), String> {
    let trash_path = get_trash_dir().join(format!("{}.json", session_id));
    let sessions_dir = get_sessions_dir();
    let dest_path = sessions_dir.join(format!("{}.json", session_id));

    if trash_path.exists() {
        if fs::rename(&trash_path, &dest_path).is_err() {
            fs::copy(&trash_path, &dest_path).map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&trash_path);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_session(session_id: String) -> Result<(), String> {
    let trash_path = get_trash_dir().join(format!("{}.json", session_id));
    if trash_path.exists() {
        fs::remove_file(trash_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn empty_trash() -> Result<(), String> {
    let trash_dir = get_trash_dir();
    if let Ok(entries) = fs::read_dir(trash_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    Ok(())
}

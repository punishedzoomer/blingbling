use std::fs;
use std::path::PathBuf;
use directories::ProjectDirs;
use serde_json::Value;

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

#[tauri::command]
pub fn save_session(session_id: String, data: Value) -> Result<(), String> {
    let file_path = get_sessions_dir().join(format!("{}.json", session_id));
    let json_str = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(file_path, json_str).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_sessions() -> Result<Vec<Value>, String> {
    let mut sessions = Vec::new();
    let dir = get_sessions_dir();
    
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_stem) = entry.path().file_stem().and_then(|s| s.to_str()) {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<Value>(&content) {
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
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(file_stem) = entry.path().file_stem().and_then(|s| s.to_str()) {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<Value>(&content) {
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

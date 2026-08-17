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

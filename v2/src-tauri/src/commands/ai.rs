use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use reqwest::Client;
use futures_util::StreamExt;
use std::sync::atomic::Ordering;
use crate::AiState;

#[tauri::command]
pub fn cancel_ai_response(state: State<'_, AiState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn stream_ai_response(
    app: AppHandle,
    state: State<'_, AiState>,
    api_key: String,
    model: String,
    messages: Vec<Value>,
) -> Result<(), String> {
    state.cancel_flag.store(false, Ordering::SeqCst);
    let client = Client::new();
    
    let mut messages_mut = messages;

    // Intercept any local file paths in the image_url payload and base64 encode them natively
    // This prevents the frontend from ever having to hold massive base64 strings in memory!
    for msg in messages_mut.iter_mut() {
        if let Some(content_array) = msg.get_mut("content").and_then(|c| c.as_array_mut()) {
            for item in content_array.iter_mut() {
                if item.get("type").and_then(|t| t.as_str()) == Some("image_url") {
                    if let Some(url_obj) = item.get_mut("image_url") {
                        if let Some(url_str) = url_obj.get("url").and_then(|u| u.as_str()) {
                            if !url_str.starts_with("http") && !url_str.starts_with("data:") {
                                if let Ok(data) = std::fs::read(url_str) {
                                    use base64::prelude::*;
                                    let b64 = BASE64_STANDARD.encode(data);
                                    *url_obj = json!({ "url": format!("data:image/jpeg;base64,{}", b64) });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let payload = json!({
        "model": model,
        "messages": messages_mut,
        "stream": true,
    });

    let res = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_default();
        return Err(format!("API Error {}: {}", status, error_body));
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    let mut is_reasoning = false;

    while let Some(item) = stream.next().await {
        if state.cancel_flag.load(Ordering::SeqCst) {
            app.emit_to("main", "ai-response", "[DONE]").unwrap();
            return Ok(());
        }

        match item {
            Ok(bytes) => {
                buffer.push_str(&String::from_utf8_lossy(&bytes));
                
                while let Some(pos) = buffer.find('\n') {
                    let line = buffer[..pos].to_string();
                    buffer = buffer[pos + 1..].to_string();
                    
                    let trimmed = line.trim();
                    if trimmed.starts_with("data: ") {
                        let data = &trimmed[6..];
                        if data == "[DONE]" {
                            app.emit_to("main", "ai-response", "[DONE]").unwrap();
                            return Ok(());
                        }
                        if let Ok(json) = serde_json::from_str::<Value>(data) {
                            let delta = &json["choices"][0]["delta"];
                            
                            if let Some(reasoning) = delta.get("reasoning").and_then(|r| r.as_str()) {
                                if !reasoning.is_empty() {
                                    if !is_reasoning {
                                        app.emit_to("main", "ai-response", "<think>\n").unwrap();
                                        is_reasoning = true;
                                    }
                                    app.emit_to("main", "ai-response", reasoning).unwrap();
                                }
                            }
                            
                            if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                if !content.is_empty() {
                                    if is_reasoning {
                                        app.emit_to("main", "ai-response", "\n</think>\n").unwrap();
                                        is_reasoning = false;
                                    }
                                    app.emit_to("main", "ai-response", content).unwrap();
                                }
                            }
                            
                            if let Some(err) = json.get("error") {
                                return Err(format!("OpenRouter Stream Error: {}", err.to_string()));
                            }
                        }
                    }
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    app.emit_to("main", "ai-response", "[DONE]").unwrap();
    Ok(())
}

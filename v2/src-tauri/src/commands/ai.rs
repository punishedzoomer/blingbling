use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use reqwest::Client;
use futures_util::StreamExt;

#[tauri::command]
pub async fn stream_ai_response(
    app: AppHandle,
    api_key: String,
    model: String,
    messages: Vec<Value>,
) -> Result<(), String> {
    let client = Client::new();
    
    let payload = json!({
        "model": model,
        "messages": messages,
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

    while let Some(item) = stream.next().await {
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
                            if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                app.emit_to("main", "ai-response", content).unwrap();
                            }
                        } else if let Ok(json) = serde_json::from_str::<Value>(data) {
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

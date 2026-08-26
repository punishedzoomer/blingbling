use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

use super::sanitizer::sanitize_messages;
use super::types::ModelKind;
use crate::AiState;

/// Streams or executes direct completion for text, image, and audio models
pub async fn execute_ai_request(
    app: AppHandle,
    state: State<'_, AiState>,
    api_key: String,
    model: String,
    messages: Vec<Value>,
) -> Result<(), String> {
    state.cancel_flag.store(false, Ordering::SeqCst);
    let client = Client::new();

    let model_kind = ModelKind::from_model_id(&model);
    let sanitized_messages = sanitize_messages(model_kind, messages);

    // 1. NON-STREAMING EXECUTION (for Image Generation and Audio Models)
    if !model_kind.supports_streaming() {
        return execute_non_streaming(&app, &client, &api_key, &model, model_kind, sanitized_messages).await;
    }

    // 2. STREAMING EXECUTION (for standard Text and Reasoning LLMs)
    execute_streaming(&app, &state, &client, &api_key, &model, sanitized_messages).await
}

fn is_raw_image_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    (lower.starts_with("http://") || lower.starts_with("https://"))
        && (lower.ends_with(".png")
            || lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".webp")
            || lower.ends_with(".gif")
            || lower.contains("oaidalleapiprod")
            || lower.contains("replicate.delivery")
            || lower.contains("blob.core.windows.net"))
        || lower.starts_with("data:image/")
}

fn append_image(output: &mut String, url: &str) {
    if !output.is_empty() {
        output.push_str("\n\n");
    }
    if url.starts_with("http") || url.starts_with("data:") {
        output.push_str(&format!("![Generated Image]({})", url));
    } else {
        output.push_str(&format!("![Generated Image](data:image/png;base64,{})", url));
    }
}

/// Recursively extracts an image URL or data string from a nested JSON value
fn extract_url_from_val(val: &Value) -> Option<String> {
    if let Some(s) = val.as_str() {
        return Some(s.to_string());
    }
    if let Some(url) = val.get("url").and_then(|u| u.as_str()) {
        return Some(url.to_string());
    }
    if let Some(img_url) = val.get("image_url") {
        if let Some(url) = img_url.as_str() {
            return Some(url.to_string());
        }
        if let Some(url) = img_url.get("url").and_then(|u| u.as_str()) {
            return Some(url.to_string());
        }
    }
    if let Some(b64) = val.get("b64_json").and_then(|b| b.as_str()) {
        return Some(format!("data:image/png;base64,{}", b64));
    }
    if let Some(img) = val.get("image") {
        if let Some(url) = img.as_str() {
            return Some(url.to_string());
        }
        if let Some(url) = img.get("url").and_then(|u| u.as_str()) {
            return Some(url.to_string());
        }
    }
    None
}

fn extract_output_markdown(json_res: &Value, model_kind: ModelKind) -> String {
    let mut output_markdown = String::new();

    // 1. Top-level OpenAI / DALL-E format: { "data": [ { "url": "..." }, { "b64_json": "..." } ] }
    if let Some(data_array) = json_res.get("data").and_then(|d| d.as_array()) {
        for item in data_array {
            if let Some(url) = extract_url_from_val(item) {
                append_image(&mut output_markdown, &url);
            }
        }
    }

    if let Some(choice) = json_res.get("choices").and_then(|c| c.get(0)) {
        let message_obj = choice.get("message").unwrap_or(choice);

        // 2. Extract content (String or Array)
        if let Some(content_val) = message_obj.get("content") {
            if let Some(text) = content_val.as_str() {
                let trimmed = text.trim();
                if is_raw_image_url(trimmed) {
                    append_image(&mut output_markdown, trimmed);
                } else {
                    output_markdown.push_str(trimmed);
                }
            } else if let Some(content_array) = content_val.as_array() {
                for item in content_array {
                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                        if !output_markdown.is_empty() {
                            output_markdown.push(' ');
                        }
                        output_markdown.push_str(text);
                    }
                    if let Some(url) = extract_url_from_val(item) {
                        append_image(&mut output_markdown, &url);
                    }
                }
            }
        }

        // 3. Extract choices[0].message.images (Array of Strings or Array of Objects)
        let images_opt = message_obj.get("images")
            .or_else(|| choice.get("images"));

        if let Some(images_array) = images_opt.and_then(|img| img.as_array()) {
            for item in images_array {
                if let Some(url) = extract_url_from_val(item) {
                    append_image(&mut output_markdown, &url);
                }
            }
        }

        // 4. Extract single image field choices[0].message.image
        if let Some(single_img) = message_obj.get("image").or_else(|| choice.get("image")) {
            if let Some(url) = extract_url_from_val(single_img) {
                append_image(&mut output_markdown, &url);
            }
        }

        // 5. Extract Audio Output (choices[0].message.audio)
        if let Some(audio) = message_obj.get("audio") {
            if let Some(transcript) = audio.get("transcript").and_then(|t| t.as_str()) {
                if !output_markdown.is_empty() {
                    output_markdown.push_str("\n\n");
                }
                output_markdown.push_str(transcript);
            }

            if let Some(b64_data) = audio.get("data").and_then(|d| d.as_str()) {
                if !output_markdown.is_empty() {
                    output_markdown.push_str("\n\n");
                }
                output_markdown.push_str(&format!("[Audio Response](data:audio/wav;base64,{})", b64_data));
            }
        }
    }

    if output_markdown.is_empty() {
        if model_kind == ModelKind::ImageGeneration {
            output_markdown = format!("*(No image data returned from model)*\n\n```json\n{}\n```", serde_json::to_string_pretty(json_res).unwrap_or_default());
        }
    }

    output_markdown
}

/// Handles non-streaming responses (Image models, Audio generation)
async fn execute_non_streaming(
    app: &AppHandle,
    client: &Client,
    api_key: &str,
    model: &str,
    model_kind: ModelKind,
    messages: Vec<Value>,
) -> Result<(), String> {
    let payload = json!({
        "model": model,
        "messages": messages,
        "stream": false,
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

    let json_res: Value = res.json().await.map_err(|e| e.to_string())?;

    // Check for API errors returned inside JSON body
    if let Some(err) = json_res.get("error") {
        return Err(format!("OpenRouter Error: {}", err.to_string()));
    }

    let output_markdown = extract_output_markdown(&json_res, model_kind);

    // Emit the complete response to the frontend
    app.emit("ai-response", &output_markdown).unwrap_or_default();
    app.emit("ai-response", "[DONE]").unwrap_or_default();

    Ok(())
}

/// Handles SSE streaming responses (Text and Reasoning LLMs)
async fn execute_streaming(
    app: &AppHandle,
    state: &State<'_, AiState>,
    client: &Client,
    api_key: &str,
    model: &str,
    messages: Vec<Value>,
) -> Result<(), String> {
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
    let mut is_reasoning = false;

    while let Some(item) = stream.next().await {
        if state.cancel_flag.load(Ordering::SeqCst) {
            app.emit("ai-response", "[DONE]").unwrap_or_default();
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
                            if is_reasoning {
                                app.emit("ai-response", "\n</think>\n").unwrap_or_default();
                            }
                            app.emit("ai-response", "[DONE]").unwrap_or_default();
                            return Ok(());
                        }

                        if let Ok(json) = serde_json::from_str::<Value>(data) {
                            let delta = &json["choices"][0]["delta"];

                            // Reasoning extraction
                            let reasoning_opt = delta
                                .get("reasoning")
                                .or_else(|| delta.get("reasoning_content"))
                                .and_then(|r| r.as_str());

                            if let Some(reasoning) = reasoning_opt {
                                if !reasoning.is_empty() {
                                    if !is_reasoning {
                                        app.emit("ai-response", "<think>\n").unwrap_or_default();
                                        is_reasoning = true;
                                    }
                                    let cleaned = reasoning.replace("<think>", "").replace("</think>", "");
                                    if !cleaned.is_empty() {
                                        app.emit("ai-response", cleaned).unwrap_or_default();
                                    }
                                }
                            }

                            // Standard content extraction
                            if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                if !content.is_empty() {
                                    if is_reasoning {
                                        app.emit("ai-response", "\n</think>\n").unwrap_or_default();
                                        is_reasoning = false;
                                    }
                                    app.emit("ai-response", content).unwrap_or_default();
                                }
                            }

                            // Streaming images / audio if present
                            if let Some(images) = delta.get("images").and_then(|img| img.as_array()) {
                                for img in images {
                                    if let Some(url) = extract_url_from_val(img) {
                                        let img_md = format!("\n\n![Generated Image]({})\n\n", url);
                                        app.emit("ai-response", img_md).unwrap_or_default();
                                    }
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

    if is_reasoning {
        app.emit("ai-response", "\n</think>\n").unwrap_or_default();
    }
    app.emit("ai-response", "[DONE]").unwrap_or_default();
    Ok(())
}

/// Generates a short 2-4 word summary title for conversations
pub async fn execute_generate_title(
    api_key: String,
    model: String,
    messages: Vec<Value>,
) -> Result<String, String> {
    let client = Client::new();

    let mut context_text = String::new();
    for msg in messages.iter().take(3) {
        if let Some(role) = msg.get("role").and_then(|r| r.as_str()) {
            if role == "system" {
                continue;
            }
            if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                context_text.push_str(&format!("{}: {}\n", role, content));
            }
        }
    }

    let payload = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": "You are a title generator. Generate an extremely short, concise title (max 2 to 4 words) that summarizes the core context and technical topic of the conversation. Do NOT use long sentences. Tell it in very few words. Do NOT use quotes, punctuation, or any introductory text. Just the title." },
            { "role": "user", "content": context_text }
        ],
        "stream": false,
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

    let json_res: Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(title) = json_res["choices"][0]["message"]["content"].as_str() {
        return Ok(title.trim().trim_matches('"').to_string());
    }

    Err("Failed to parse title from response".to_string())
}

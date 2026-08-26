use base64::prelude::*;
use serde_json::{json, Value};
use std::path::Path;
use super::types::ModelKind;

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

/// Detects the MIME type of an image file based on extension
fn get_image_mime(path_str: &str) -> &'static str {
    let ext = Path::new(path_str)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "image/jpeg",
    }
}

/// Resolves local file paths, asset:// URLs, or base64 data URIs into full base64 data URLs for OpenRouter
fn resolve_to_base64_data_url(url_str: &str) -> Option<String> {
    if url_str.starts_with("data:image/") || url_str.starts_with("http://") || url_str.starts_with("https://") {
        return Some(url_str.to_string());
    }

    let mut path_str = url_str;
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
    let path = Path::new(&decoded_path);
    if let Ok(bytes) = std::fs::read(path) {
        let mime = get_image_mime(&decoded_path);
        let b64 = BASE64_STANDARD.encode(bytes);
        return Some(format!("data:{};base64,{}", mime, b64));
    }
    None
}

/// Detects the audio format of an audio file based on extension
fn get_audio_format(path_str: &str) -> &'static str {
    let ext = Path::new(path_str)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "wav" => "wav",
        "mp3" => "mp3",
        "ogg" => "ogg",
        "m4a" | "aac" => "m4a",
        _ => "wav",
    }
}

/// Sanitizes and encodes multimodal payloads (images, audio) and cleans message arrays
pub fn sanitize_messages(model_kind: ModelKind, messages: Vec<Value>) -> Vec<Value> {
    let mut sanitized = Vec::new();

    for mut msg in messages {
        let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user").to_string();

        // 1. Skip system messages for image generation models
        if !model_kind.supports_system_prompt() && role == "system" {
            continue;
        }

        // 2. Intercept local file paths in content arrays and convert to base64
        let mut has_images = false;
        if let Some(content_array) = msg.get_mut("content").and_then(|c| c.as_array_mut()) {
            for item in content_array.iter_mut() {
                // Image processing
                if item.get("type").and_then(|t| t.as_str()) == Some("image_url") {
                    has_images = true;
                    if let Some(url_obj) = item.get_mut("image_url") {
                        if let Some(url_str) = url_obj.get("url").and_then(|u| u.as_str()) {
                            if let Some(resolved) = resolve_to_base64_data_url(url_str) {
                                *url_obj = json!({ "url": resolved });
                            }
                        }
                    }
                }

                // Audio input processing
                if item.get("type").and_then(|t| t.as_str()) == Some("input_audio") {
                    if let Some(audio_obj) = item.get_mut("input_audio") {
                        if let Some(path_str) = audio_obj.get("path").and_then(|p| p.as_str()) {
                            if let Ok(data) = std::fs::read(path_str) {
                                let format = get_audio_format(path_str);
                                let b64 = BASE64_STANDARD.encode(data);
                                *audio_obj = json!({ "data": b64, "format": format });
                            }
                        }
                    }
                }
            }
        }

        // For image generation models WITHOUT attached images, collapse text into a single prompt string.
        // If image inputs ARE attached (image-to-image / reference editing), preserve the structured content array!
        if model_kind == ModelKind::ImageGeneration && !has_images {
            if let Some(content_array) = msg.get("content").and_then(|c| c.as_array()) {
                let mut combined_text = String::new();
                for item in content_array {
                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                        if !combined_text.is_empty() {
                            combined_text.push(' ');
                        }
                        combined_text.push_str(text);
                    }
                }
                if !combined_text.is_empty() {
                    msg["content"] = json!(combined_text);
                }
            }
        }

        sanitized.push(msg);
    }

    // For image generation, ensure we only send the latest user prompt if there are multiple
    if model_kind == ModelKind::ImageGeneration && sanitized.len() > 1 {
        if let Some(last_user) = sanitized.iter().rev().find(|m| m.get("role").and_then(|r| r.as_str()) == Some("user")) {
            return vec![last_user.clone()];
        }
    }

    sanitized
}

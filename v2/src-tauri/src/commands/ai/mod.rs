pub mod types;
pub mod sanitizer;
pub mod executor;

use serde_json::Value;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, State};
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
    executor::execute_ai_request(app, state, api_key, model, messages).await
}

#[tauri::command]
pub async fn generate_title(
    api_key: String,
    model: String,
    messages: Vec<Value>,
) -> Result<String, String> {
    executor::execute_generate_title(api_key, model, messages).await
}

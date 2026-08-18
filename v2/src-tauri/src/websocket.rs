use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;

pub async fn start_server(app: AppHandle) {
    let addr = "127.0.0.1:14444";
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind WebSocket listener: {}", e);
            return;
        }
    };
    
    println!("Extension Companion WebSocket Server running on ws://{}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let app_handle = app.clone();
        tokio::spawn(async move {
            if let Ok(mut ws_stream) = accept_async(stream).await {
                while let Some(msg_result) = ws_stream.next().await {
                    if let Ok(msg) = msg_result {
                        if msg.is_text() {
                            let text = msg.to_text().unwrap();
                            // When the extension sends a Base64 image, we forward it to the main React frontend
                            if let Err(e) = app_handle.emit_to("main", "extension-snip-received", text) {
                                eprintln!("Failed to emit extension snip: {}", e);
                            }
                        }
                    }
                }
            }
        });
    }
}

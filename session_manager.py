import os
import json
import uuid
import datetime
import sys

def get_app_data_dir():
    home = os.path.expanduser("~")
    if sys.platform == "darwin":
        return os.path.join(home, "Library", "Application Support", "BlingBling")
    else:
        return os.path.join(home, ".blingbling")

SESSIONS_DIR = os.path.join(get_app_data_dir(), "sessions")

if not os.path.exists(SESSIONS_DIR):
    os.makedirs(SESSIONS_DIR)

def get_all_sessions():
    """Returns a list of dicts with session metadata, sorted newest first."""
    sessions = []
    for file in os.listdir(SESSIONS_DIR):
        if file.endswith('.json'):
            path = os.path.join(SESSIONS_DIR, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    sessions.append({
                        "id": data.get("id"),
                        "title": data.get("title", "Untitled Session"),
                        "created_at": data.get("created_at"),
                        "updated_at": data.get("updated_at")
                    })
            except Exception as e:
                print(f"Error loading session {file}: {e}")
                
    sessions.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return sessions

def load_session(session_id):
    """Loads full session data including history."""
    path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_session(session_id, history, title=None):
    """Saves a session to disk."""
    if not history:
        return # Don't save empty sessions
        
    path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    
    # Try to extract a title from the first user message if none provided
    if not title:
        title = "New Session"
        for msg in history:
            if msg["role"] == "user":
                content = msg["content"]
                
                content_str = ""
                if isinstance(content, list):
                    text_parts = [item.get("text", "") for item in content if item.get("type") == "text"]
                    content_str = " ".join(text_parts)
                elif isinstance(content, str):
                    content_str = content
                    
                clean_content = ""
                if "User Question/Instruction: " in content_str:
                    user_q = content_str.split("User Question/Instruction: ")[-1].strip()
                    if user_q:
                        clean_content = user_q
                        
                if not clean_content and "Here is the context extracted from screen captures:\n\n" in content_str:
                    context_block = content_str.split("Here is the context extracted from screen captures:\n\n")[-1]
                    context_block = context_block.split("\n\nUser Question/Instruction:")[0]
                    context_block = context_block.split("\n\nPlease solve the problem")[0]
                    
                    lines = [line.strip() for line in context_block.split('\n') if line.strip()]
                    if lines:
                        clean_content = lines[0]
                        
                if not clean_content:
                    clean_content = content_str
                    
                if not clean_content.strip():
                    clean_content = "Image Query"
                    
                clean_content = clean_content.strip().split("\n")[0]
                title = clean_content[:40] + ("..." if len(clean_content) > 40 else "")
                break
                
    if not title.strip():
        title = "Untitled Session"

    now = datetime.datetime.now().isoformat()
    
    data = {
        "id": session_id,
        "title": title,
        "history": history,
        "updated_at": now
    }
    
    # Preserve created_at if it exists
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            old_data = json.load(f)
            data["created_at"] = old_data.get("created_at", now)
            # If a title was already auto-generated and saved, keep it
            if old_data.get("title") and old_data.get("title") != "New Session" and old_data.get("title") != "Untitled Session":
                data["title"] = old_data.get("title")
    else:
        data["created_at"] = now
        
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False) # Skip indent to save space with base64 images

def create_session_id():
    return str(uuid.uuid4())

import io
import mss
import base64
from PIL import Image
from openai import OpenAI
from PySide6.QtCore import QThread, Signal
import config

def capture_screen_bytes():
    """Captures the primary monitor and returns JPEG encoded bytes."""
    with mss.mss() as sct:
        # monitor 1 is usually the primary monitor
        monitor = sct.monitors[1]
        sct_img = sct.grab(monitor)
        img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
        
        # Compress to JPEG in-memory
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        return buffer.getvalue()

class LLMWorker(QThread):
    chunk_received = Signal(str)
    reasoning_chunk = Signal(str)
    finished = Signal()
    error_occurred = Signal(str)

    history_updated = Signal(list)

    def __init__(self, images_list, ocr_model, reasoning_model, user_prompt, conversation_history, api_key):
        super().__init__()
        self.images_list = images_list
        self.ocr_model = ocr_model
        self.reasoning_model = reasoning_model
        self.user_prompt = user_prompt
        self.conversation_history = conversation_history
        self.api_key = api_key

    def run(self):
        try:
            # Initialize client pointing to OpenRouter API using config
            client = OpenAI(
                base_url=config.OPENROUTER_BASE_URL,
                api_key=self.api_key,
                default_headers=config.OPENROUTER_HEADERS
            )
            
            extracted_context = ""
            
            # --- STAGE 1: OCR (Only if there are new images) ---
            if self.images_list:
                self.chunk_received.emit(f"*(Extracting context from {len(self.images_list)} snip(s) with {self.ocr_model}...)*\n\n")
                
                content = [{"type": "text", "text": "You are a raw OCR engine. Your ONLY job is to transcribe the text, code, and math exactly as it appears in the images. DO NOT solve the problem. DO NOT answer any questions. DO NOT explain anything. ONLY output the raw extracted text verbatim."}]
                
                for img_bytes in self.images_list:
                    base64_image = base64.b64encode(img_bytes).decode('utf-8')
                    content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}})
                
                ocr_response = client.chat.completions.create(
                    model=self.ocr_model,
                    messages=[{"role": "user", "content": content}],
                    stream=True,
                )
                
                for chunk in ocr_response:
                    if chunk.choices[0].delta.content is not None:
                        text = chunk.choices[0].delta.content
                        extracted_context += text
                        self.chunk_received.emit(text)
                
                self.chunk_received.emit(f"\n\n---\n\n")
            
            # --- STAGE 2: Reasoning ---
            self.chunk_received.emit(f"*(Reasoning with {self.reasoning_model}...)*\n\n")
            
            # Construct the new user message
            if extracted_context:
                prompt_instruction = f"User Question/Instruction: {self.user_prompt}" if self.user_prompt.strip() else "Please solve the problem or answer the implied question based on this context. Be extremely concise and provide the optimal solution."
                new_message_content = f"Here is the context extracted from screen captures:\n\n{extracted_context}\n\n{prompt_instruction}"
            else:
                new_message_content = self.user_prompt
            
            self.conversation_history.append({"role": "user", "content": new_message_content})
            
            reasoning_response = client.chat.completions.create(
                model=self.reasoning_model,
                messages=self.conversation_history,
                stream=True,
                extra_body={"include_reasoning": True}
            )
            
            full_assistant_reply = ""
            full_reasoning_trace = ""
            for chunk in reasoning_response:
                # OpenRouter extra_body={"include_reasoning": True} will send reasoning in a separate field or inside model_extra
                # Try to extract reasoning securely from delta
                reasoning = None
                if hasattr(chunk.choices[0].delta, 'reasoning') and chunk.choices[0].delta.reasoning:
                    reasoning = chunk.choices[0].delta.reasoning
                elif getattr(chunk.choices[0].delta, 'reasoning_content', None):
                    reasoning = chunk.choices[0].delta.reasoning_content
                elif getattr(chunk.choices[0].delta, 'model_extra', None) and 'reasoning' in chunk.choices[0].delta.model_extra:
                    reasoning = chunk.choices[0].delta.model_extra['reasoning']
                    
                if reasoning:
                    full_reasoning_trace += reasoning
                    self.reasoning_chunk.emit(reasoning)
                    
                if chunk.choices[0].delta.content is not None:
                    text = chunk.choices[0].delta.content
                    full_assistant_reply += text
                    self.chunk_received.emit(text)
            
            self.conversation_history.append({
                "role": "assistant", 
                "content": full_assistant_reply,
                "reasoning": full_reasoning_trace
            })
            self.chunk_received.emit("\n\n---\n\n")
            self.history_updated.emit(self.conversation_history)
                    
        except Exception as e:
            self.error_occurred.emit(f"\n\n**Error:** {str(e)}\n\nMake sure OPENROUTER_API_KEY is set in your environment.")
            
        self.finished.emit()

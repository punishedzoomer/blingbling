use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModelKind {
    /// Standard text and reasoning LLMs (supports SSE streaming)
    TextLlm,
    /// Image generation models (e.g. FLUX, SDXL, Imagen, DALL-E, Recraft, Banana/Gemini Image)
    ImageGeneration,
    /// Audio generation and speech models (e.g. GPT-4o Audio, ElevenLabs, Whisper)
    AudioModel,
}

impl ModelKind {
    /// Automatically classifies a model based on its OpenRouter model ID
    pub fn from_model_id(model_id: &str) -> Self {
        let lower = model_id.to_lowercase();

        // 1. Image generation models
        if lower.contains("flux")
            || lower.contains("stable-diffusion")
            || lower.contains("sdxl")
            || lower.contains("imagen")
            || lower.contains("dall-e")
            || lower.contains("midjourney")
            || lower.contains("recraft")
            || lower.contains("ideogram")
            || lower.contains("playground")
            || lower.contains("auraflow")
            || lower.contains("aura-flow")
            || lower.contains("cogview")
            || lower.contains("kolors")
            || lower.contains("kandinsky")
            || lower.contains("black-forest-labs")
            || lower.contains("stabilityai/stable-diffusion")
            || lower.contains("stabilityai/sd")
            || lower.contains("-image")
            || lower.ends_with("image")
            || lower.contains("banana")
        {
            return ModelKind::ImageGeneration;
        }

        // 2. Audio output/generation models
        if lower.contains("audio")
            || lower.contains("whisper")
            || lower.contains("tts")
            || lower.contains("speech")
            || lower.contains("elevenlabs")
        {
            return ModelKind::AudioModel;
        }

        // 3. Default to standard Text/Reasoning LLM
        ModelKind::TextLlm
    }

    /// Whether this model supports SSE token-by-token streaming
    pub fn supports_streaming(&self) -> bool {
        match self {
            ModelKind::TextLlm => true,
            ModelKind::ImageGeneration => false,
            ModelKind::AudioModel => false,
        }
    }

    /// Whether this model supports system prompt messages
    pub fn supports_system_prompt(&self) -> bool {
        match self {
            ModelKind::TextLlm => true,
            ModelKind::ImageGeneration => false,
            ModelKind::AudioModel => true,
        }
    }
}

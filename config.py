import os

# OpenRouter API Configuration
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

OPENROUTER_HEADERS = {
    "HTTP-Referer": "https://github.com/my-project",
    "X-Title": "BlingBling Assistant",
}

# Models for Stage 1: Optical Character Recognition (Vision)
OCR_MODELS = [
    "qwen/qwen3-vl-32b-instruct",
    "google/gemini-3.7-flash",
]

# Models for Stage 2: Problem Solving & Coding (Reasoning)
REASONING_MODELS = [
    "deepseek/deepseek-v4-pro",
    "moonshotai/kimi-k3",
    "openai/o3-pro",
    "openai/o3-mini-high",
    "meta-llama/llama-3.3-70b-instruct",
    "x-ai/grok-2",
    "google/gemini-3.1-pro-preview",
]

# UI Configuration
WINDOW_OPACITY = 0.95

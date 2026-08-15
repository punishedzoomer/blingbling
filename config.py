import os

# OpenRouter API Configuration
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

OPENROUTER_HEADERS = {
    "HTTP-Referer": "https://github.com/punishedzoomer/blingbling",
    "X-Title": "BlingBling Assistant",
}

# Models for Stage 1: Optical Character Recognition (Vision)
OCR_MODELS = [
    "None (Direct Vision)",
    "qwen/qwen3-vl-32b-instruct",
    "google/gemini-3.7-flash",
]

# Models for Stage 2: Problem Solving & Coding (Reasoning)
REASONING_MODELS = [
    "anthropic/claude-3.5-sonnet",  # The gold standard for coding. Pricier, but worth it for hard problems.
    "deepseek/deepseek-reasoner",   # Incredible reasoning capability, insanely cheap ($0.14/M tokens)
    "deepseek/deepseek-chat",       # Fast and extremely cheap
    "moonshotai/kimi-k3",           # High tier, very affordable
    "meta-llama/llama-3.3-70b-instruct", # Very cheap open-source powerhouse
    "google/gemini-3.7-flash",      # Extremely cheap, your current baseline
]

# UI Configuration
WINDOW_OPACITY = 0.95

"""Central configuration. Everything is env-overridable; nothing is hardcoded per model."""

import os

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
# Preferred model when the client does not specify one. Overridable via env.
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:12b")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

"""REST endpoints: model discovery and health."""

from fastapi import APIRouter

from . import ollama_client
from .config import DEFAULT_MODEL, OLLAMA_URL

router = APIRouter()


@router.get("/api/models")
async def list_models_endpoint():
    """List locally installed Ollama models with their vision capability."""
    try:
        models = await ollama_client.list_models()
    except RuntimeError as exc:
        return {"ollama": "unreachable", "ollama_url": OLLAMA_URL,
                "default_model": DEFAULT_MODEL, "models": [], "error": str(exc)}
    return {
        "ollama": "connected",
        "ollama_url": OLLAMA_URL,
        "default_model": DEFAULT_MODEL,
        "models": models,
    }


@router.get("/api/health")
async def health():
    discovery = await list_models_endpoint()
    return {
        "status": "healthy" if discovery["ollama"] == "connected" else "degraded",
        "ollama": discovery["ollama"],
        "models": [m["name"] for m in discovery["models"]],
        **({"error": discovery["error"]} if "error" in discovery else {}),
    }

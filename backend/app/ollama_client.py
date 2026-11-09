"""Thin async client for the local Ollama HTTP API."""

import httpx

from .config import OLLAMA_URL


async def list_models() -> list[dict]:
    """Return installed Ollama models, each tagged with a best-effort vision flag.

    An empty list means the server is reachable but has no chat models.
    Connection failures raise RuntimeError so callers can distinguish these states.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            names = [
                m.get("name") for m in response.json().get("models", [])
                if m.get("name") and
                (not m.get("capabilities") or "completion" in m["capabilities"])
            ]
    except (httpx.HTTPError, ValueError) as exc:
        raise RuntimeError(
            f"Cannot query Ollama at {OLLAMA_URL}. Check that Ollama is running "
            f"and the endpoint is correct. ({type(exc).__name__})"
        ) from exc

    models: list[dict] = []
    for name in names:
        models.append({"name": name, "vision": await detect_vision(name)})
    return models


async def detect_vision(name: str) -> bool:
    """Ask Ollama whether a model declares the 'vision' capability.

    Some model formats do not report capabilities; in that case we conservatively
    answer False so the frontend never sends images to a model that may reject them.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/show", json={"name": name}
            )
            response.raise_for_status()
            capabilities = response.json().get("capabilities") or []
            return "vision" in capabilities
    except Exception:
        return False


async def chat(model: str, messages: list[dict], timeout: float = 300.0) -> str:
    """Send a chat request to Ollama and return the model's text reply."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
        )
        response.raise_for_status()
        return response.json().get("message", {}).get("content", "").strip()

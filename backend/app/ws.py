"""WebSocket chat endpoint: canvas analysis, tutoring, and structured board actions."""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from . import ollama_client, prompts, summarize, verify
from .config import DEFAULT_MODEL, OLLAMA_URL

router = APIRouter()

_VALID_OPS = {"add_text", "add_shape"}
_SHAPE_KINDS = {"rectangle", "ellipse", "line", "arrow"}
_TEXT_SIZES = {"s", "m", "l", "xl"}
_COLORS = {
    "black", "grey", "lightgrey", "brown", "orange", "red", "darkorange",
    "darkred", "pink", "lightgreen", "green", "darkgreen", "skyblue",
    "blue", "darkblue", "purple", "yellow",
}


def _sanitize_actions(raw: str | None) -> list[dict] | None:
    """Extract a strict list of add-only board actions from a model reply, or None."""
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list):
        return None

    actions: list[dict] = []
    for item in data[:5]:
        if not isinstance(item, dict) or item.get("op") not in _VALID_OPS:
            continue
        action = {"op": item["op"]}
        for key in ("x", "y", "w", "h", "text"):
            if key in item and isinstance(item[key], (int, float, str)):
                action[key] = item[key]
        if item.get("color") in _COLORS:
            action["color"] = item["color"]
        if item.get("size") in _TEXT_SIZES:
            action["size"] = item["size"]
        if item.get("shape") in _SHAPE_KINDS:
            action["shape"] = item["shape"]
        if action["op"] == "add_text" and action.get("text", "").strip():
            actions.append(action)
        elif action["op"] == "add_shape" and action.get("shape") in _SHAPE_KINDS:
            action.setdefault("w", 240)
            action.setdefault("h", 120)
            actions.append(action)
    return actions or None


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"status": "error", "error": "Invalid JSON payload."})
                )
                continue

            rid = payload.get("id")
            model = str(payload.get("model") or DEFAULT_MODEL).strip()
            mode = payload.get("mode") or "chat"
            shapes = payload.get("shapes") or []
            prompt = str(payload.get("prompt") or "").strip()
            image_b64 = payload.get("image_base64") or None

            base = {"id": rid}

            try:
                models = await ollama_client.list_models()
            except RuntimeError as exc:
                await websocket.send_text(json.dumps({**base, "status": "error", "error": str(exc)}))
                continue
            if not models:
                await websocket.send_text(json.dumps({
                    **base,
                    "status": "error",
                    "error": (
                        f"Ollama at {OLLAMA_URL} is reachable but has no chat models. "
                        "Install a chat model, then refresh the model list."
                    ),
                }))
                continue

            names = [m["name"] for m in models]
            if model not in names:
                await websocket.send_text(json.dumps({**base, "status": "error",
                    "error": f"Model '{model}' is not an installed chat model. Refresh and select a model."}))
                continue
            vision = next(
                (m["vision"] for m in models if m["name"] == model), False
            )

            await websocket.send_text(
                json.dumps({**base, "status": "thinking", "model": model})
            )

            canvas = summarize.summarize_canvas(shapes)

            if mode == "actions":
                system = prompts.SYSTEM_PROMPT + prompts.ACTIONS_PROMPT
                user_text = (
                    f"Whiteboard contents:\n{canvas}\n\n"
                    f"Student request: {prompt or 'Add a brief worked example that explains the work on the board.'}"
                )
            elif mode == "analyze":
                system = prompts.SYSTEM_PROMPT
                user_text = (
                    f"Whiteboard contents:\n{canvas}\n\n"
                    f"{prompt or prompts.ANALYZE_PROMPT}"
                )
            else:
                system = prompts.SYSTEM_PROMPT
                user_text = f"Whiteboard contents:\n{canvas}"
                if prompt:
                    user_text += f"\n\nStudent message: {prompt}"

            messages: list[dict] = [{"role": "system", "content": system}]
            if image_b64:
                if not vision:
                    await websocket.send_text(json.dumps({
                        **base,
                        "status": "error",
                        "error": (
                            f"Model '{model}' does not support image input, so "
                            "whiteboard image analysis is unavailable with it. "
                            "Switch to a vision-capable model to enable this."
                        ),
                    }))
                    continue
                messages.append({"role": "user", "content": user_text,
                                 "images": [image_b64]})
            else:
                messages.append({"role": "user", "content": user_text})

            try:
                reply = await ollama_client.chat(model, messages)
            except Exception as exc:  # noqa: BLE001 - report any backend failure
                await websocket.send_text(json.dumps({
                    **base,
                    "status": "error",
                    "model": model,
                    "error": f"Ollama request failed: {exc}",
                }))
                continue

            final: dict = {
                **base,
                "status": "done",
                "model": model,
                "vision": vision,
                "response": reply,
            }

            verified = verify.verify_equation(prompt) or verify.verify_equation(canvas)
            if verified:
                final["verified"] = verified

            if mode == "actions":
                actions = _sanitize_actions(reply)
                if actions:
                    final["actions"] = actions
                    final["response"] = (
                        "I added the requested content to your board. "
                        "Use 'Undo AI changes' if you want it back the way it was."
                    )
            await websocket.send_text(json.dumps(final))
    except WebSocketDisconnect:
        print("WebSocket disconnected")

"""Simple end-to-end WebSocket test for the /ws/chat endpoint.

Usage (from anywhere, with the backend running):
    python ws_test.py
"""

import asyncio
import json
import urllib.request

import websockets

API = "http://localhost:8000"
WS = "ws://localhost:8000/ws/chat"


def show(label: str, value) -> None:
    print(f"[{label}] {value}")


async def main() -> None:
    info = json.load(urllib.request.urlopen(f"{API}/api/models", timeout=10))
    models = info.get("models", [])
    show("ollama", info.get("ollama"))
    show("models", models)
    model = models[0]["name"] if models else "gemma4:12b"
    show("using model", model)

    async with websockets.connect(WS) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "model": model,
            "mode": "analyze",
            "prompt": "Solve 2x+3=11 for x, step by step, in under 120 words.",
            "shapes": [
                {"type": "text", "props": {"text": "2x + 3 = 11", "x": 10, "y": 10}}
            ],
        }))
        while True:
            msg = json.loads(await ws.recv())
            show(msg.get("status", "?"), msg)
            if msg.get("status") in ("done", "error"):
                break


if __name__ == "__main__":
    asyncio.run(main())

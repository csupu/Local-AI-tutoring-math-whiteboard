# Math Tools — AI Whiteboard Tutor

A local, private AI math tutor built on a **tldraw whiteboard**. Draw or write math
problems on an infinite canvas, ask an **Ollama LLM** (running fully offline on your
machine) to analyze the board, explain the solution step-by-step with rendered
LaTeX, and — with one command — have it **draw the solution right onto the canvas**
(rectangles, arrows, and labeled formulas).

> Everything runs locally. No accounts, no cloud, no telemetry.

---

## Features

- **tldraw whiteboard** — infinite canvas with the standard tools (draw, shapes,
  arrows, text, sticky notes) and native pan/zoom/keyboard shortcuts.
- **Dynamic model selection** — pick *any* model installed in Ollama (e.g.
  `gemma4:12b`, `qwen3.8:27b`, `phi4-mini`) via a top-bar dropdown that reads
  `GET /api/models`, with a **vision flag** per model.
- **AI chat panel** — three modes: **Chat** (free-form), **Analyze board** (work
  the problem step-by-step with rendered KaTeX), and **Add to board** (the model
  returns structured actions that draw text and shapes onto the canvas — additive
  only, with an **Undo AI changes** button).
- **Vision support** — vision-capable models can take a **screenshot of the board**
  to read handwriting the shape list can't capture.
- **Verified answers** — the backend solves recognizable linear equations with
  **SymPy** and shows a `✓ SymPy check` next to the reply.
- **Auto-analyze** — optional: after you stop drawing, the board is analyzed
  automatically (debounced).
- **Collapsible, resizable panel** and a **live status** pill
  (*Waiting / Analyzing… / Ready / Error*).
- **Themes, snap grid & background color** — dark/light UI, an optional snap grid,
  and a custom canvas background.

---

## Architecture

```
┌────────────────────────────┐   WebSocket  ws://localhost:8000/ws/chat
│  Browser (React + tldraw)  │◄──────────────────────────────────────────
│  http://localhost:5173     │   REST       GET /api/models
└─────────────┬──────────────┘
              │  Ollama REST API (http://localhost:11434)
              ▼
        ┌────────────┐
        │ FastAPI    │  backend/
        │  + uvicorn │   ├─ main.py          (app factory, CORS, routers)
        └─────┬──────┘   └─ app/
              │          ├─ routes.py        (GET /api/models, /api/health)
              ▼          ├─ ws.py            (WS /ws/chat + action sanitizer)
          ┌─────────┐    ├─ ollama_client.py (list_models, chat, vision)
          │ Ollama  │    ├─ prompts.py       (system/analyze/actions prompts)
          │  LLMs   │    ├─ summarize.py     (canvas → text)
          └─────────┘    └─ verify.py        (SymPy equation check)
```

- **Frontend:** React 18 + TypeScript + Vite. `tldraw` for the canvas, `katex`
  for math rendering, `marked` for markdown, and a small `ws.ts` client.
- **Backend:** Python **FastAPI** + **uvicorn** + **httpx** + **SymPy**.
  `GET /api/models` lists installed Ollama models (with a vision flag);
  `WS /ws/chat` runs one request/response turn against `POST /api/chat`.
- **AI actions protocol:** in *actions* mode the model replies with a JSON array
  of add-only actions; the backend validates it (`ws.py`) and the frontend applies
  it with the tldraw editor API (`lib/aiActions.ts`). Additive only — the AI never
  deletes or moves your shapes.

---

## Requirements

| Dependency | Version | Notes |
|------------|---------|-------|
| **Python** | 3.10+ | Backend |
| **Node.js** | 18+   | Frontend build/dev |
| **Ollama** | latest  | `ollama serve` (default port `11434`) |

---

## Installation

### 1. Ollama (one-time)

```powershell
# 1. Install Ollama (https://ollama.com) and start it
ollama serve

# 2. Pull at least one model (any name works — the app lists what's installed)
ollama pull llama3.2:11b
ollama pull phi3        # optional
```

### 2. Backend

```powershell
cd c:\mathtools\backend
pip install -r requirements.txt
```

### 3. Frontend

```powershell
cd c:\mathtools\frontend
npm install
```

---

## Running

### Easiest — double-click

**`start.cmd`** (or `start.ps1`) at the project root opens a dashboard window that:

1. Checks Python, Node and Ollama are installed.
2. Installs missing dependencies automatically.
3. Launches the backend (`:8000`) and the Vite dev server (`:5173`).
4. Shows a live console + an **Open in Browser** button.

### Manual (two terminals)

```powershell
# Terminal 1 — backend
cd c:\mathtools\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd c:\mathtools\frontend
npm run dev
```

Then open **http://localhost:5173**.

> **Production build** (optional):
> `cd c:\mathtools\frontend && npm run build`
> FastAPI serves the built `frontend/dist` automatically, so afterwards you only
> need to run the backend.

---

## Using the app

1. **Pick a model** from the dropdown in the top bar (any Ollama model you've
   pulled). The *Waiting / Analyzing… / Ready / Error* pill shows state.
2. **Draw a problem** on the canvas. Text shapes are sent to the model as their
   literal text; drawn shapes (arrows, rectangles) are sent as their type so the
   model understands the structure.
3. **Ask the tutor** (bottom of the panel):
   - *"Solve this"* → the model walks through the solution with LaTeX.
   - *"Draw the solution"* → the model returns `ai-actions` and the panel offers an
     **Add to board** button.
4. **Auto-analyze** (top-bar toggle) watches for 12 s of no drawing, then fires an
   analysis automatically.
5. **Themes & grid** (top bar, right) — dark/light UI and an optional snap grid.

### Keyboard shortcuts (tldraw defaults)

| Key | Tool |
|-----|------|
| `V` | Select |
| `H` | Hand (pan) |
| `D` | Draw (pencil) |
| `E` | Eraser |
| `T` | Text |
| `R` | Rectangle |
| `L` | Ellipse |
| `A` | Arrow |
| `N` | Sticky note |
| `F` | Frame |
| `Space` + drag | Pan |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z` | Redo |
| `Del` | Delete selection |

---

## AI actions protocol

In **actions** mode the model must answer with **only** a JSON array (no prose, no
fences) of *additive* actions. Each item uses an `op` of either `add_text` or
`add_shape`:

````
[
  { "op": "add_text", "x": 0, "y": -60, "text": "Step 1: move the constant", "color": "blue", "size": "m" },
  { "op": "add_shape", "shape": "rectangle", "x": -220, "y": 20, "w": 140, "h": 90, "color": "yellow" }
]
````

Rules enforced by the backend (`ws.py`, `_sanitize_actions`):
- **Additive only** — there is no delete/move/change op. **Undo AI changes**
  removes only the shapes the AI added; your own work is never touched.
- Max **5** actions.
- `add_shape.shape` ∈ `rectangle`, `ellipse`, `line`, `arrow`.
- `add_text.size` ∈ `s`, `m`, `l`, `xl`.
- Colors: `black, grey, lightgrey, brown, orange, red, darkorange, darkred, pink,
  lightgreen, green, darkgreen, skyblue, blue, darkblue, purple, yellow`.
- Coordinates are relative to the current **viewport center** (`0,0` = center).
- Any invalid item is dropped; if nothing survives, no actions are applied.

---

## Configuration

Backend environment variables (`backend/app/config.py`; set before launching):

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama HTTP endpoint |
| `OLLAMA_MODEL` | `gemma4:12b` | Fallback model when the client sends none |

CORS origins are the four `localhost`/`127.0.0.1` on ports `5173` and `4173`
(dev + preview). The server listens on `0.0.0.0:8000`.

Frontend build-time config lives in `frontend/vite.config.ts` (the `/api` and `/ws`
proxies are already wired to the backend).

---

## Project structure

```
mathtools/
├── start.cmd / start.ps1          # one-click launcher (Python, Node, Ollama)
├── README.md
├── backend/
│   ├── requirements.txt           # fastapi, uvicorn, httpx, websockets, ollama, sympy
│   ├── main.py                    # app factory, CORS, includes routes + ws routers
│   ├── ws_test.py                 # ad-hoc WebSocket smoke test
│   └── app/
│       ├── __init__.py
│       ├── config.py              # OLLAMA_URL, DEFAULT_MODEL, ALLOWED_ORIGINS
│       ├── ollama_client.py       # list_models(), detect_vision(), chat()
│       ├── routes.py              # GET /api/models, GET /api/health
│       ├── ws.py                  # WS /ws/chat + _sanitize_actions()
│       ├── prompts.py             # SYSTEM / ANALYZE / ACTIONS prompts
│       ├── summarize.py           # summarize_canvas(shapes) → text
│       └── verify.py              # verify_equation(text) → SymPy check
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── index.css              # theme tokens (dark/light), layout
        ├── App.tsx                # composition root, auto-analyze, AI actions
        ├── hooks/
        │   └── useOllamaModels.ts # fetches /api/models into React state
        ├── lib/
        │   ├── ws.ts              # WebSocket client + shared types
        │   ├── state.ts           # localStorage preferences + helpers
        │   ├── aiActions.ts       # applyAiActions() / undoAiActions()
        │   └── MathText.tsx       # KaTeX renderer
        └── components/
            ├── TopBar.tsx         # brand, model select, status, theme, grid, bg
            ├── Whiteboard.tsx     # <Tldraw> with theme/grid via editor prefs
            └── TutorPanel.tsx     # chat panel, actions, verified answer
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Model dropdown is empty | `ollama serve` must be running and at least one model pulled. Click **Refresh** in the top bar (or restart the backend). |
| WS pill says **Waiting** / **Error** | Backend not up. Run `start.cmd` (or `python -m uvicorn main:app --port 8000` from `backend/`). |
| `CORS` errors in the browser | Add your origin to `ALLOWED_ORIGINS` in `backend/app/config.py`. |
| Model ignores the board | Draw with **text** where possible — text shapes are sent as literal text; freehand strokes are only counted. |
| "Add to board" does nothing | The model must return a valid JSON array of `add_text`/`add_shape` actions; otherwise it's treated as a normal chat reply. |
| Image/vision analysis unavailable | Pick a **vision-capable** model (e.g. `gemma4:12b`, `qwen3.8:27b`) — non-vision models can't take a board screenshot. |
| Frontend blank on `:8000` | You hit the backend directly. Open the Vite dev server at `:5173`, or run `npm run build` first. |

---

## License

**Proprietary — all rights reserved.** Copyright (c) 2026 csupu.

The original project code is not offered under an open-source license.
Copying, modification, redistribution, and other uses require prior written
permission, except where applicable law or a separately applicable license
permits otherwise. See [LICENSE](LICENSE) for the full notice and permission
request details. Third-party dependencies retain their own licenses.

This notice applies from the commit introducing it onward. Earlier versions,
including the original `v1.0` release, contained different licensing wording;
this change does not revoke permissions previously granted for those versions.
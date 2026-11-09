# MathTutor diagnostic and repair report

Date: November 8, 2026 (America/Chicago). Workspace: `C:\mathtools`.

## A. Environment and baseline

- React and React DOM **19.3.1**, TypeScript **5.9.3**, Vite **6.4.5**, `@tldraw/tldraw` **3.15.6**, KaTeX **0.16.47**; Node **24.13.0**. React 19 is within the installed tldraw package's declared peer range. README's React 18 description is outdated.
- FastAPI **0.162.0**, uvicorn **0.54.0**, httpx **0.28.1**, SymPy **1.14.0**, Python **3.15.2**. Usable executable: `C:\Users\cjwar\AppData\Local\Python\pythoncore-3.15-64\python.exe`. No project virtual environment found. Bare `python` resolves to an inaccessible WindowsApps alias in the command environment.
- Entrypoints: `frontend/src/main.tsx`, `backend/main.py`; launcher: `start.cmd` → `start.ps1`. Vite proxies `/api` and `/ws` to `MATHTOOLS_BACKEND`, default `http://localhost:8000`. Ollama backend config: `OLLAMA_URL`, default `http://localhost:11434`; fallback `OLLAMA_MODEL`, default `gemma4:12b`. Ports remain **5173 / 8000 / 11434**.
- Ollama **0.40.15** responds to `/api/tags` and `/api/show`. Installed capabilities below were queried from Ollama, not inferred from names.

| Installed model | Reported capabilities | App chat choice after repair |
|---|---|---|
| `gemma4:12b` | completion, vision, audio, tools, thinking | Yes |
| `qwen:latest` | completion | Yes; text only |
| `qwen3.8:27b` | completion, vision, tools, thinking | Yes |
| `nomic-embed-text:latest` | embedding | No |

- GPU: RTX 5070, 12,227 MiB VRAM. One sample during testing showed 11,035 MiB used and 11% utilization. `/api/ps` later reported `qwen:latest` with a 32,768-token context and about 10.2 GB VRAM allocated. These are snapshots, not a performance profile.
- Browser automation **available and used**: in-app Chromium browser with DOM inspection, computed styles, screenshots, native mouse drags, keyboard input, console logs, and viewport controls. No repository Playwright suite or Chrome DevTools MCP configuration was found. No browser dependency installed.
- Existing automated test: `backend/ws_test.py`, an ad hoc live-Ollama smoke script. No frontend test script. Added `backend/test_regressions.py` using existing dependencies.
- `git status --short` fails: **this folder is not a Git repository**. No Git branch/worktree or tracked-change baseline was possible; no applicable AGENTS.md found. Original copies of every changed existing source file are in `diagnostics/original/`. No dependency upgrades, model changes, or IndexedDB deletion performed. Only agent-created test shapes were removed from the initially empty automation-browser board.
- GitHub tools were discovered, but the folder provides no remote/repository identity to associate with the tagged GitHub connection. Local evidence was used.

## B. Confirmed problems and repairs

### 1. Whiteboard controls/canvas render without required tldraw CSS — fixed, browser verified

Reproduce baseline: run the documented Vite and uvicorn commands, open `http://127.0.0.1:5173`, inspect the board. Controls appeared as tiny unstyled strips. `frontend/src/main.tsx:4` now imports `@tldraw/tldraw/tldraw.css` before application CSS. That stylesheet exists in the installed package; no package migration was needed.

The reported parent collapse was **not reproduced**. All outer dimensions were usable. The first dimensional divergence was inside `.tl-container`: `.tl-canvas` was only 154px tall and `.tl-background` was 0px tall. Both became 672px tall with the single stylesheet import. Existing `.board-area > :first-child` placement was retained because it already positioned the actual tldraw root correctly.

1280 × 720 viewport, tutor open; bounding dimensions and computed dimensions agreed:

| Element | Before W × H | After W × H | Before display / position / flex | Minimum W / H | Before overflow / visibility / z-index |
|---|---|---|---|---|---|
| html | 1280 × 720 | 1280 × 720 | block / static / 0 1 auto | 0 / 0 | visible / visible / auto |
| body | 1280 × 720 | 1280 × 720 | block / static / 0 1 auto | 0 / 0 | hidden / visible / auto |
| #root | 1280 × 720 | 1280 × 720 | block / static / 0 1 auto | 0 / 0 | visible / visible / auto |
| .app-shell | 1280 × 720 | 1280 × 720 | flex / static / 0 1 auto | 0 / 0 | visible / visible / auto |
| .app-main | 1280 × 672 | 1280 × 672 | flex / static / 1 1 0% | auto / 0 | visible / visible / auto |
| .board-area | 880 × 672 | 880 × 672 | block / relative / 1 1 0% | 0 / auto | visible / visible / auto |
| .tl-container | 880 × 672 | 880 × 672 | block / absolute / 0 1 auto | 0 / 0 | visible / visible / auto |
| .tl-canvas | 880 × 154 | 880 × 672 | block / static | — | — |
| .tl-background | 880 × 0 | 880 × 672 | block / static | — | — |

After import, `.tl-container` overflow becomes `clip`, `.tl-canvas` position becomes `absolute`, and `.tlui-layout` becomes a full-size grid with z-index 300. Full final computed properties: `layout-after.json`. Screenshots: `whiteboard-before.jpg`, `whiteboard-after.jpg`, `whiteboard-final.jpg`.

Browser checks passed: mouse pencil stroke created a draw shape; eraser removed it; Undo restored it (count 1), Redo removed it (count 0); Text tool entered `2x+3=11`; collapse expanded canvas width from 880 to 1234px, expand restored it. The repaired tldraw root fills its parent. No isolated page was necessary.

### 2. Narrow-screen tutor layout clips controls — fixed, browser verified

At 800 × 720, inline desktop width kept the tutor at 400px despite the media rule's `width:100%`; the original 55vh board minimum and panel content extended the input bottom to **724.05px**, beyond the hidden-overflow viewport. `frontend/src/index.css:287` now overrides the inline width at the breakpoint, allocates available height with flex proportions, and permits the message area to shrink. The collapsed rail also becomes horizontal.

After: board/tldraw **800 × 369.59**, tutor **800 × 302.41**, input bottom exactly **720px**. Screenshot: `whiteboard-narrow.jpg`. Desktop dimensions remain unchanged. Other mobile sizes and touch interaction were not exhaustively tested.

### 3. Launcher cannot reliably start/stay running — fixed, startup verified

`start.ps1:32` onward: protect occupied service ports; prefer `backend/.venv` or a real installed Python, bypassing the Store alias; use strict Vite port selection and explicit IPv4 binding; limit cleanup to owned child processes.

Two additional failures were reproduced during full launcher execution: Vite's localhost binding did not satisfy the IPv4-only readiness probe, and `Wait-Process -Timeout 31536000` immediately failed because Windows PowerShell permits at most **32767** seconds. The latter was printed directly during diagnosis. Replaced that wait with child-process monitoring and `finally` cleanup. Removed both blanket `Stop-Process -Name node` calls. Full corrected launcher reports both services ready and stays active. Reinvocation with running services exits with a clear occupied-port message and leaves them alone. PowerShell syntax parsing passed. All terminated processes during diagnosis were test servers started in this session.

### 4. Typed tldraw equations disappear from board summary — fixed, live verified

Installed schema `frontend/node_modules/@tldraw/tlschema/dist-esm/shapes/TLTextShape.mjs` stores text as `props.richText` and migrates away from `props.text`. Original `backend/app/summarize.py` read only `props.text`. Added safe rich-text traversal at `summarize.py:6`; legacy text remains supported at line 36.

Regression tests cover both forms. Live browser Text-tool equation `2x+3=11`, followed by Send without a typed prompt, reached `qwen:latest`, whose reply explicitly repeated the equation. **Recognition/transport passed; tutoring correctness did not**: its worked steps were mathematically wrong. Screenshot: `typed-analysis.jpg`.

### 5. SymPy verification silently fails — fixed, tests and live UI verified

Original `verify_equation('2x+3=11')` returned `None`. It solved the equation but attempted `sp.Rational(lhs)` on a symbolic expression when formatting the reply; the broad exception handler swallowed that failure. `backend/app/verify.py:30` now constructs exact rational coefficients and line 45 formats the equation directly. Bare signed coefficients are supported.

Tests pass for `2x+3=11`, `-x+4=-2`, and decimal arithmetic; invalid/unsupported input returns no verification. No arbitrary Python evaluation or model-generated code execution added. Live UI shows **x = 4**. The message explicitly says it independently solves the equation and **does not verify the AI explanation**. General expression equivalence is available in installed SymPy and was tested with symbolic objects; it is **not an application feature/API**.

### 6. Ollama status/model handling conflates distinct states — fixed, mocked cases plus live health verified

Original `list_models()` returned `[]` for both failed connections and reachable servers with zero models; REST and WebSocket callers labeled both unreachable. It also offered the installed embedding model for chat and silently substituted the first model when a requested identifier was invalid.

Changes: `backend/app/ollama_client.py:11`, `routes.py:14`, `ws.py:87`; frontend error propagation in `hooks/useOllamaModels.ts:12` and `components/TopBar.tsx:80`. Reachable-empty, unavailable backend, unavailable Ollama, invalid identifier, and image-incompatible models now have distinct outcomes/messages. Embedding-only models are filtered when capabilities are supplied by tags. Vision is queried through `/api/show`. Empty/unreachable and compatibility cases pass mocked regression tests; live `/api/health` returns healthy/connected with three chat choices.

`ECONNREFUSED 127.0.0.1:11434` was **not reproduced against Ollama**. An initial restricted command had socket access denied; an approved direct query succeeded. That restriction is not evidence of a stopped Ollama server. No model reinstall/download/deletion or second server launch occurred. MathTutor and Ollama were reached from native Windows processes. Cline's current provider endpoint was not located in the standard profile checked, so its specific historic error remains unverified; no Cline settings changed.

### 7. Observation includes session noise and permits obsolete replies — repaired, live supersession verified

Original `frontend/src/App.tsx` listened to every store change, ignored changes while busy, and had no document/model revision check before displaying replies/applying actions. Current lines 58, 102, and 166 filter auto triggers to user document changes, retain a deferred trigger during an active request, and discard replies when board/model changed. Request correlation and the existing busy guard prevent overlapping UI requests.

Experiment: enabled Auto, drew another stroke, made no Send click; user-request count advanced from 2 to 3 and Ollama described 16 strokes. Separate experiment: clicked Send, immediately drew again; final UI said **Discarded an outdated AI reply** and did not append that reply. Screenshot: `stale-response.jpg`. Model inference itself is not cancelled; only obsolete result delivery is suppressed. Deferred busy-edit behavior is implemented but was not separately timing-tested.

### 8. Backend's dormant vision message uses wrong API structure — fixed at protocol boundary

`backend/app/ws.py:149` now sends a string `content` plus message-level `images: [base64]`, instead of an array of content blocks. This matches [Ollama's official API documentation](https://github.com/ollama/ollama/blob/main/docs/api.md). Regression test captures and asserts the outgoing structure and rejects image input for text-only models. **A real vision-model inference was not performed**, because the frontend image-capture path is absent; this repair does not implement handwriting recognition.

## C. Unconfirmed hypotheses and limitations

- Parent height collapse, package incompatibility, corrupt IndexedDB persistence, and obstructing elements were not supported as the desktop whiteboard cause. No persistence reset attempted.
- Historic Cline refusal attribution, its active endpoint/model selection, possible WSL usage by Cline, and duplicate Ollama processes remain unknown. No port conflict was observed in the successful live Ollama requests.
- No model-loading latency benchmark or sustained GPU profile; the initial gemma request was interrupted by development reloads, so it provides no correctness or latency result.
- Editing hook declarations during hot reload briefly produced React hook-order errors. A full reload recovered; a new clean browser tab after all edits reported **no console warnings/errors**. This transient editing artifact is not treated as a remaining cold-load defect.
- WebSocket disconnects can leave a request pending until the existing five-minute timeout; cancellation/early failure remains a follow-up.

## D. Missing or incomplete features

- **Handwriting recognition: not implemented end to end.** `App.tsx:97` sends shape type/props only, never a canvas export or `image_base64`. Draw strokes are counted by `summarize.py`, not recognized. Mouse-drawn `2x+3=11` (15 strokes) was tested separately: the model received a stroke count and failed to identify the equation. Screenshots: `handwritten-equation.jpg`, `handwritten-analysis.jpg`.
- Recommended next pipeline: export a debounced, bounded PNG from tldraw, strip the data-URL prefix, attach image base64, and require reported vision capability. Installed `gemma4:12b` and `qwen3.8:27b` qualify by `/api/show`; recognition quality and hardware fit still need a real benchmark. Do not use `qwen:latest` or the embedding model for vision. Display recognized mathematics for confirmation before symbolic checking.
- AI annotations: implemented code exists but **not verified working**. Source audit flags incompatible shape IDs (`shape_ai...` at `frontend/src/lib/aiActions.ts:15`), placement inside props, old text props, non-schema shape/fill names, and type assertions hiding errors. A separate repair with actual editor-schema tests is needed; no success claim made here.
- Adjustable pencil sizes are supplied by tldraw; an adjustable eraser-radius control was not verified. Basic mouse erasing is verified.
- General equivalence checking, multi-step error checking, proof verification, and validation of model explanations are not implemented.
- Board background selection is stored by App but not passed to Whiteboard; Grid currently updates snap mode, not the visible grid flag. These are source-audit follow-ups, not browser-verified repairs.
- README claims FastAPI serves the production frontend, but `backend/main.py` has no static-file mount. Production build succeeds; serving that build via FastAPI is incomplete. README also describes a launcher dashboard/dependency installer that this launcher does not contain.

## E. Commands, tests, and evidence

Executed commands include:

```powershell
git status --short                           # failed: not a Git repository
rg --files                                  # structure/docs/tests/source inspection
node --version
npm ls --depth=0 --prefix frontend
python --version                            # failed: WindowsApps alias
& 'C:/Users/cjwar/AppData/Local/Python/pythoncore-3.15-64/python.exe' --version
# From frontend/:
npm run dev -- --host 127.0.0.1 --strictPort
npm run build                               # passed after final frontend changes
# From backend/, using the executable above:
python -m uvicorn main:app --host 127.0.0.1 --port 8000
python -m unittest -v test_regressions        # 10 passed, 0.155s final run
# Full launcher and occupied-port checks:
powershell -NoProfile -ExecutionPolicy Bypass -File C:/mathtools/start.ps1
Invoke-RestMethod http://127.0.0.1:11434/api/tags
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Also queried `/api/show` for all four installed models, `/api/ps`, listener/process information, Ollama version, and `nvidia-smi`. Backend tests are repeatable and offline with mocked Ollama calls; `backend-tests.txt` preserves output. They do not prove model accuracy. Existing `ws_test.py` was inspected but not run; the actual browser WebSocket conversation provided the live integration check instead.

Build warning: JS bundle exceeds Vite's 500kB advisory limit (about 2.05MB minified); build succeeds. Backend TestClient emits an httpx deprecation warning; tests succeed. Restricted-environment HTTP initialization stalled; approved execution completed quickly. Initial restricted Vite instance also accepted no usable browser HTTP connection; only that owned process was restarted with appropriate execution access. No new browser tools or dependencies were installed.

Browser evidence covers desktop and narrow sizing, drawing, erasing, text, history, panel collapse/expand, typed/live analysis, handwritten/live analysis, auto trigger, stale rejection, clean reload, and final dimensions. Test-created shapes were removed and Auto/model/minimap preferences restored in the automation browser; saved user boards in other browser profiles were not touched.

## F. Remaining priorities

| Priority | Work | Impact / estimated effort |
|---|---|---|
| 1 | Add real visual capture and benchmark handwriting with an installed vision model | Core missing product capability; medium |
| 1 | Validate tutor explanations/steps rather than trusting model prose | Live model gave wrong mathematics; high |
| 2 | Repair AI annotation schema integration and exercise actual editor actions | Advertised feature remains unverified and source-incompatible; medium |
| 2 | Close pending requests promptly on socket failure; cancel/supersede inference | Responsiveness/resource use; medium |
| 3 | Add general safe expression equivalence and broader mathematical recognition | Current checker handles narrow linear syntax only; medium/high |
| 3 | Fix background/grid wiring, production serving, README, and establish Git tracking | Reliability and maintenance; low/medium |

State at delivery: primary whiteboard repair **verified working**; launcher **verified running**; Ollama connectivity **verified working**; typed equation delivery and basic SymPy solving **verified working**; continuous metadata observation and stale-result rejection **verified working**; handwritten equation understanding **not implemented**; model explanation correctness **failed the live test**; AI annotation behavior **not verified**.

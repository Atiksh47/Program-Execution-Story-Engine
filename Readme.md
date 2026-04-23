# Program Execution Story Engine

A tool that traces real Python execution and replays it as an interactive, step-by-step visual timeline — with optional AI-generated narrative powered by Claude.

## What it does

Submit any Python snippet. The backend runs it under `sys.settrace`, capturing variable state, call stack depth, and control flow at every execution step. The frontend lets you scrub through that timeline step by step, watching variables change, the call stack grow and shrink, and the active line highlight in real time. Optionally, ask Claude to annotate the run with per-step labels, execution phases, and a plain-English summary.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI |
| Tracer | `sys.settrace` (stdlib) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| LLM | Claude API (`claude-sonnet-4-6`) |

## Local setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An Anthropic API key (only needed for the narration feature)

### 1 — Clone and set up the backend

```bash
git clone https://github.com/your-username/program-execution-story-engine.git
cd program-execution-story-engine

python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install -r backend/requirements.txt
```

### 2 — Configure environment variables

```bash
cp .env.example .env
# edit .env and paste your ANTHROPIC_API_KEY
```

### 3 — Start the backend

```bash
uvicorn backend.main:app --reload --port 8000
```

The API is now at `http://localhost:8000`. The `/trace` endpoint works without an API key; `/narrate` requires one.

### 4 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## API

### `POST /trace`

Run a Python snippet and return its execution timeline.

**Request**
```json
{ "code": "def factorial(n):\n    if n <= 1: return 1\n    return n * factorial(n-1)\nresult = factorial(5)" }
```

**Response** — `TraceResponse`
```json
{
  "events": [
    {
      "step": 0,
      "event": "call",
      "line_no": 1,
      "source_line": "def factorial(n):",
      "func_name": "factorial",
      "locals": { "n": 5 },
      "call_stack": ["<module>", "factorial"],
      "depth": 2,
      "return_value": null
    }
  ],
  "total_steps": 44,
  "capped": false,
  "stdout": ""
}
```

- `event` is one of `"call"`, `"line"`, `"return"`
- `capped` is `true` when the program exceeded the 500-step limit
- `stdout` contains any captured `print()` output

### `POST /narrate`

Send the timeline to Claude and get back per-step labels, phase boundaries, and a summary.

**Request**
```json
{ "events": [...], "code": "..." }
```

**Response** — `NarrationResponse`
```json
{
  "step_labels": { "0": "enter factorial(5)", "1": "check base case" },
  "phases": [
    { "name": "Recursive Descent", "start_step": 0, "end_step": 24 },
    { "name": "Stack Unwind", "start_step": 25, "end_step": 43 }
  ],
  "summary": "Factorial computes 5! by recursing to the base case then multiplying on the way back up."
}
```

### `GET /health`

Returns `{ "status": "ok", "narrate_available": true/false }`. Useful for deploy health checks.

## Architecture

```
Browser (React)
  │
  ├─ POST /trace ──► FastAPI
  │                    └─ ast.parse()       syntax check
  │                    └─ sandbox.py        safe exec + timeout
  │                    └─ sys.settrace      event-by-event capture
  │                    └─ TraceResponse ◄──
  │
  └─ POST /narrate ──► FastAPI
                         └─ narrator.py     build prompt
                         └─ Claude API      claude-sonnet-4-6
                         └─ NarrationResponse ◄──
```

### Sandbox constraints

- Dangerous builtins blocked: `open`, `exec`, `eval`, `compile`, `__import__`, `breakpoint`, `input`
- `print()` is captured and returned as `stdout` rather than writing to the terminal
- Execution timeout: 5 seconds (thread-based with `ctypes` async exception injection)
- Local variable snapshots capped at 100-item sequences and 500-char reprs to bound memory usage
- Maximum 500 trace events per run

## Deployment

### Backend — Render

1. Create a new **Web Service** on [render.com](https://render.com), point it at this repo
2. Render will detect `render.yaml` and configure the service automatically
3. Add the environment variable `ANTHROPIC_API_KEY` in the Render dashboard
4. Add your Render service URL to `ALLOWED_ORIGINS` (see below)

### Frontend — Vercel

1. Import this repo into [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Vercel detects Vite automatically; no extra config needed
4. Add env var `VITE_API_URL` pointing to your Render backend URL

### Production CORS

Set the `ALLOWED_ORIGINS` environment variable on your backend to a comma-separated list of allowed frontend origins:

```
ALLOWED_ORIGINS=https://your-app.vercel.app
```

Without this, the backend defaults to `http://localhost:5173` (development only).

## Development notes

- The tracer introduces ~250× wall-clock overhead vs. native execution due to per-step deep-copy of local scope — expected for instrumentation at this depth
- `sys.settrace` fires on every bytecode event; the 500-step cap keeps response sizes sane for recursive programs
- The narration prompt instructs Claude to return only JSON; `narrator.py` strips any stray markdown fences and fills in any steps Claude missed

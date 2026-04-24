import json
import os
import re
import urllib.request
from typing import Generator

from backend.models import TraceEvent, NarrationResponse, Phase

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.environ.get("OLLAMA_MODEL",    "qwen3.5:0.8b")

# Truncate long traces so the small model's context window isn't overwhelmed
MAX_EVENTS_IN_PROMPT = 60


def _build_prompt(events: list[TraceEvent], code: str) -> str:
    shown = events[:MAX_EVENTS_IN_PROMPT]
    truncated = len(events) > MAX_EVENTS_IN_PROMPT

    timeline_summary = [
        {
            "step":   e.step,
            "event":  e.event,
            "func":   e.func_name,
            "line":   e.source_line.strip(),
            "locals": e.locals,
            "depth":  e.depth,
        }
        for e in shown
    ]

    trunc_note = (
        f"\n(trace truncated to first {MAX_EVENTS_IN_PROMPT} of {len(events)} steps)"
        if truncated else ""
    )
    n_steps = len(shown)
    last    = n_steps - 1

    return f"""You are analyzing a Python program's execution trace.

Source code:
```python
{code}
```

Execution timeline ({n_steps} steps shown){trunc_note}:
{json.dumps(timeline_summary, indent=2)}

Return a JSON object with exactly this structure:
{{
  "step_labels": {{
    "<step_number_as_string>": "<short label describing what happens at this step>"
  }},
  "phases": [
    {{"name": "<phase name>", "start_step": <int>, "end_step": <int>}}
  ],
  "summary": "<one or two sentence plain-English summary of what the program does and how>"
}}

Rules:
- Label every step (0 through {last}). Keep labels under 8 words.
- Phases capture the high-level narrative arc (e.g. "Initialization", "Recursive Descent", "Stack Unwind", "Loop Body").
- Use 2–5 phases. Phases must not overlap, and together must cover every step exactly once.
- Output step_labels first, then phases, then summary (in that order).
- summary should be what you'd tell a recruiter in 10 seconds.
- Return only valid JSON, no markdown fences, no extra commentary."""


def _strip_thinking(text: str) -> str:
    """Remove <think>…</think> blocks emitted by reasoning models."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _parse_and_validate(raw: str, n_steps: int) -> NarrationResponse:
    raw = _strip_thinking(raw)

    # Strip accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Model returned unparseable JSON: {e}\n\nRaw output:\n{raw[:400]}")

    try:
        step_labels: dict[str, str] = dict(data["step_labels"])
        raw_phases: list[dict]      = list(data["phases"])
        summary: str                = str(data["summary"])
    except (KeyError, TypeError) as e:
        raise ValueError(f"Model JSON was missing required fields: {e}")

    for i in range(n_steps):
        step_labels.setdefault(str(i), f"step {i}")

    phases = _repair_phases(raw_phases, n_steps)
    return NarrationResponse(step_labels=step_labels, phases=phases, summary=summary)


def _repair_phases(raw_phases: list[dict], n_steps: int) -> list[Phase]:
    last   = n_steps - 1
    parsed: list[Phase] = []

    for p in raw_phases:
        try:
            start = max(0, min(int(p["start_step"]), last))
            end   = max(0, min(int(p["end_step"]),   last))
            name  = str(p.get("name", "Phase"))
            if start <= end:
                parsed.append(Phase(name=name, start_step=start, end_step=end))
        except (KeyError, TypeError, ValueError):
            continue

    if not parsed:
        return [Phase(name="Execution", start_step=0, end_step=last)]

    parsed.sort(key=lambda p: p.start_step)
    fixed: list[Phase] = []
    for p in parsed:
        if fixed and p.start_step <= fixed[-1].end_step:
            p = Phase(name=p.name, start_step=fixed[-1].end_step + 1, end_step=p.end_step)
        if p.start_step > p.end_step:
            continue
        fixed.append(p)

    if not fixed:
        return [Phase(name="Execution", start_step=0, end_step=last)]

    result: list[Phase] = []
    if fixed[0].start_step > 0:
        result.append(Phase(name="Execution", start_step=0, end_step=fixed[0].start_step - 1))
    result.extend(fixed)

    complete: list[Phase] = [result[0]]
    for p in result[1:]:
        prev_end = complete[-1].end_step
        if p.start_step > prev_end + 1:
            complete.append(Phase(name="Execution", start_step=prev_end + 1, end_step=p.start_step - 1))
        complete.append(p)
    if complete[-1].end_step < last:
        complete.append(Phase(name="Execution", start_step=complete[-1].end_step + 1, end_step=last))

    return complete


def narrate_stream(events: list[TraceEvent], code: str) -> Generator[str, None, None]:
    """Stream SSE events from the local Ollama model."""
    prompt  = _build_prompt(events, code)
    payload = json.dumps({
        "model":    OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": "/no_think"},
            {"role": "user",   "content": prompt},
        ],
        "stream": True,
    }).encode()

    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    full_text = ""
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            while True:
                line = resp.readline()
                if not line:
                    break
                line = line.decode().strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                chunk = obj.get("message", {}).get("content", "")
                if chunk:
                    full_text += chunk
                    yield f"data: {json.dumps({'type': 'delta', 'text': chunk})}\n\n"

                if obj.get("done"):
                    break

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'detail': f'Ollama error: {e}'})}\n\n"
        return

    try:
        narration = _parse_and_validate(full_text, len(events[:MAX_EVENTS_IN_PROMPT]))
    except ValueError as e:
        yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'done', 'narration': narration.model_dump()})}\n\n"

import json
import os
from typing import Generator

from backend.models import TraceEvent, NarrationResponse, Phase


def _build_prompt(events: list[TraceEvent], code: str) -> str:
    timeline_summary = [
        {
            "step": e.step,
            "event": e.event,
            "func": e.func_name,
            "line": e.source_line.strip(),
            "locals": e.locals,
            "depth": e.depth,
        }
        for e in events
    ]
    return f"""You are analyzing a Python program's execution trace.

Source code:
```python
{code}
```

Execution timeline ({len(events)} steps):
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
- Label every step (0 through {len(events) - 1}). Keep labels under 8 words.
- Phases capture the high-level narrative arc (e.g. "Initialization", "Recursive Descent", "Stack Unwind", "Loop Body").
- Use 2–5 phases. Phases must not overlap, and together must cover every step exactly once.
- Output step_labels first, then phases, then summary (in that order).
- summary should be what you'd tell a recruiter in 10 seconds.
- Return only valid JSON, no markdown fences."""


def _parse_and_validate(raw: str, n_steps: int) -> NarrationResponse:
    """Parse Claude's JSON output, fill gaps, and normalise phases."""
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned unparseable JSON: {e}")

    try:
        step_labels: dict[str, str] = dict(data["step_labels"])
        raw_phases: list[dict] = list(data["phases"])
        summary: str = str(data["summary"])
    except (KeyError, TypeError) as e:
        raise ValueError(f"Claude's JSON was missing required fields: {e}")

    # Fill in any steps Claude missed
    for i in range(n_steps):
        step_labels.setdefault(str(i), f"step {i}")

    # Validate and repair phases
    phases = _repair_phases(raw_phases, n_steps)

    return NarrationResponse(step_labels=step_labels, phases=phases, summary=summary)


def _repair_phases(raw_phases: list[dict], n_steps: int) -> list[Phase]:
    """
    Sort phases, clamp step values, fill any gaps, and collapse overlaps so the
    resulting list partitions [0, n_steps - 1] exactly.
    """
    last = n_steps - 1

    # Parse whatever Claude returned, clamping to valid range
    parsed: list[Phase] = []
    for p in raw_phases:
        try:
            start = max(0, min(int(p["start_step"]), last))
            end = max(0, min(int(p["end_step"]), last))
            name = str(p.get("name", "Phase"))
            if start <= end:
                parsed.append(Phase(name=name, start_step=start, end_step=end))
        except (KeyError, TypeError, ValueError):
            continue

    if not parsed:
        return [Phase(name="Execution", start_step=0, end_step=last)]

    # Sort by start, resolve overlaps by capping end at next start - 1
    parsed.sort(key=lambda p: p.start_step)
    fixed: list[Phase] = []
    for i, p in enumerate(parsed):
        if fixed and p.start_step <= fixed[-1].end_step:
            p = Phase(name=p.name, start_step=fixed[-1].end_step + 1, end_step=p.end_step)
        if p.start_step > p.end_step:
            continue
        fixed.append(p)

    if not fixed:
        return [Phase(name="Execution", start_step=0, end_step=last)]

    # Fill leading gap
    result: list[Phase] = []
    if fixed[0].start_step > 0:
        result.append(Phase(name="Execution", start_step=0, end_step=fixed[0].start_step - 1))
    result.extend(fixed)

    # Fill internal gaps and trailing gap
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
    """Yields SSE-formatted strings. Emits delta events then a done event."""
    from anthropic import Anthropic
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    prompt = _build_prompt(events, code)
    full_text = ""

    try:
        with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for chunk in stream.text_stream:
                full_text += chunk
                yield f"data: {json.dumps({'type': 'delta', 'text': chunk})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
        return

    try:
        narration = _parse_and_validate(full_text, len(events))
    except ValueError as e:
        yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'done', 'narration': narration.model_dump()})}\n\n"

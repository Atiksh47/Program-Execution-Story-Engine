import json
import os

from backend.models import TraceEvent, NarrationResponse, Phase


def narrate(events: list[TraceEvent], code: str) -> NarrationResponse:
    from anthropic import Anthropic
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

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

    prompt = f"""You are analyzing a Python program's execution trace.

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
- summary should be what you'd tell a recruiter in 10 seconds.
- Return only valid JSON, no markdown fences."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        timeout=30,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        raw = message.content[0].text.strip()
        # Strip markdown fences if Claude ignores the instruction
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
    except (IndexError, json.JSONDecodeError) as e:
        raise ValueError(f"Claude returned a response that could not be parsed as JSON: {e}")

    try:
        step_labels: dict[str, str] = data["step_labels"]
        phases = [Phase(**p) for p in data["phases"]]
        summary: str = data["summary"]
    except (KeyError, TypeError) as e:
        raise ValueError(f"Claude's JSON was missing required fields: {e}")

    # Fill in any steps Claude missed so the frontend always has a label
    for i in range(len(events)):
        step_labels.setdefault(str(i), f"step {i}")

    return NarrationResponse(step_labels=step_labels, phases=phases, summary=summary)

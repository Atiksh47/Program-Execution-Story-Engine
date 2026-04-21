import json
import os
from anthropic import Anthropic
from backend.models import TraceEvent, NarrationResponse, Phase

client = Anthropic()


def narrate(events: list[TraceEvent], code: str) -> NarrationResponse:
    timeline_summary = []
    for e in events:
        timeline_summary.append({
            "step": e.step,
            "event": e.event,
            "func": e.func_name,
            "line": e.source_line.strip(),
            "locals": e.locals,
            "depth": e.depth,
        })

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
- Label every step. Keep labels under 8 words.
- Phases should capture the high-level narrative arc (e.g. "Initialization", "Recursive Descent", "Stack Unwind", "Loop Body", "Base Case").
- Use 2–5 phases. Every step must fall within exactly one phase range.
- summary should be what you'd tell a recruiter in 10 seconds.
- Return only valid JSON, no markdown fences."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    data = json.loads(raw)

    phases = [Phase(**p) for p in data["phases"]]
    return NarrationResponse(
        step_labels=data["step_labels"],
        phases=phases,
        summary=data["summary"],
    )

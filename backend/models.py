from pydantic import BaseModel
from typing import Any


class TraceEvent(BaseModel):
    step: int
    event: str  # "call", "line", "return"
    line_no: int
    source_line: str
    func_name: str
    locals: dict[str, Any]
    call_stack: list[str]
    depth: int
    return_value: Any = None


class TraceRequest(BaseModel):
    code: str


class TraceResponse(BaseModel):
    events: list[TraceEvent]
    total_steps: int
    capped: bool


class NarrationRequest(BaseModel):
    events: list[TraceEvent]
    code: str


class StepLabel(BaseModel):
    label: str


class Phase(BaseModel):
    name: str
    start_step: int
    end_step: int


class NarrationResponse(BaseModel):
    step_labels: dict[str, str]
    phases: list[Phase]
    summary: str

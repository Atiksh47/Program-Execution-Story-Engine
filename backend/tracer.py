import sys
import ast
from backend.models import TraceEvent
from backend.sandbox import safe_copy_locals, SAFE_GLOBALS, run_with_timeout, TimeoutError

MAX_STEPS = 500


class ExecutionTracer:
    def __init__(self, source_lines: list[str]):
        self.source_lines = source_lines
        self.events: list[TraceEvent] = []
        self.call_stack: list[str] = []
        self.step = 0
        self.capped = False

    def _get_source_line(self, lineno: int) -> str:
        idx = lineno - 1
        if 0 <= idx < len(self.source_lines):
            return self.source_lines[idx].rstrip()
        return ""

    def _tracer(self, frame, event, arg):
        if self.step >= MAX_STEPS:
            self.capped = True
            return None

        func_name = frame.f_code.co_filename
        # Only trace user code, not stdlib internals
        if func_name != "<string>":
            return None

        func_name = frame.f_code.co_name

        if event == "call":
            self.call_stack.append(func_name)
        elif event == "return":
            pass  # record before popping

        locals_snapshot = safe_copy_locals(frame.f_locals)
        return_value = None
        if event == "return":
            try:
                import copy
                return_value = copy.deepcopy(arg)
            except Exception:
                return_value = repr(arg)

        trace_event = TraceEvent(
            step=self.step,
            event=event,
            line_no=frame.f_lineno,
            source_line=self._get_source_line(frame.f_lineno),
            func_name=func_name,
            locals=locals_snapshot,
            call_stack=list(self.call_stack),
            depth=len(self.call_stack),
            return_value=return_value,
        )
        self.events.append(trace_event)
        self.step += 1

        if event == "return":
            if self.call_stack:
                self.call_stack.pop()

        return self._tracer

    def run(self, code: str):
        compiled = compile(code, "<string>", "exec")
        globals_copy = dict(SAFE_GLOBALS)

        def execute():
            sys.settrace(self._tracer)
            try:
                exec(compiled, globals_copy)
            finally:
                sys.settrace(None)

        run_with_timeout(execute, timeout_seconds=5.0)


def trace_code(code: str) -> tuple[list[TraceEvent], bool]:
    source_lines = code.splitlines()
    tracer = ExecutionTracer(source_lines)
    tracer.run(code)
    return tracer.events, tracer.capped

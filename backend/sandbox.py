import threading
import copy
import types
import ctypes


BLOCKED_BUILTINS = {
    "open", "exec", "eval", "compile", "__import__",
    "breakpoint", "input",
    # print is intentionally allowed — it's replaced per-execution with OutputCapture.print_fn
}

SAFE_BUILTINS = {
    k: v for k, v in __builtins__.items()
    if k not in BLOCKED_BUILTINS
} if isinstance(__builtins__, dict) else {
    k: getattr(__builtins__, k)
    for k in dir(__builtins__)
    if k not in BLOCKED_BUILTINS and not k.startswith("__")
}


class OutputCapture:
    def __init__(self):
        self.lines: list[str] = []

    def print_fn(self, *args, sep: str = " ", end: str = "\n", **kwargs) -> None:
        self.lines.append(sep.join(str(a) for a in args) + end)

    @property
    def output(self) -> str:
        return "".join(self.lines)


def make_safe_globals() -> tuple[dict, OutputCapture]:
    capture = OutputCapture()
    safe_builtins = dict(SAFE_BUILTINS)
    safe_builtins["print"] = capture.print_fn
    return {"__builtins__": safe_builtins}, capture


class TimeoutError(Exception):
    pass


def _kill_thread(thread_id: int) -> None:
    """Inject SystemExit into a running thread at the next bytecode boundary (CPython only)."""
    ctypes.pythonapi.PyThreadState_SetAsyncExc(
        ctypes.c_ulong(thread_id),
        ctypes.py_object(SystemExit),
    )


def run_with_timeout(fn, timeout_seconds: float = 5.0):
    result: dict = {"value": None, "error": None}
    thread_id_holder: list[int] = []

    def target():
        thread_id_holder.append(threading.current_thread().ident)  # type: ignore[arg-type]
        try:
            result["value"] = fn()
        except SystemExit:
            result["error"] = TimeoutError(f"Execution exceeded {timeout_seconds}s limit")
        except Exception as e:
            result["error"] = e

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout=timeout_seconds)

    if thread.is_alive():
        if thread_id_holder:
            _kill_thread(thread_id_holder[0])
        thread.join(timeout=1.0)  # give it a moment to exit cleanly
        raise TimeoutError(f"Execution exceeded {timeout_seconds}s limit")

    if result["error"] is not None:
        raise result["error"]

    return result["value"]


_SKIP_TYPES = (
    types.FunctionType, types.MethodType, types.ModuleType,
    types.BuiltinFunctionType, types.BuiltinMethodType, type,
)

_MAX_SEQ_ITEMS = 100
_MAX_REPR_LEN = 500


def safe_copy_locals(frame_locals: dict) -> dict:
    snapshot = {}
    for k, v in frame_locals.items():
        if k.startswith("__") or isinstance(v, _SKIP_TYPES):
            continue
        try:
            if hasattr(v, "__len__") and len(v) > _MAX_SEQ_ITEMS:
                snapshot[k] = f"<{type(v).__name__} with {len(v)} items>"
            else:
                copied = copy.deepcopy(v)
                r = repr(copied)
                snapshot[k] = copied if len(r) <= _MAX_REPR_LEN else r[:_MAX_REPR_LEN] + "…"
        except Exception:
            r = repr(v)
            snapshot[k] = r[:_MAX_REPR_LEN] + ("…" if len(r) > _MAX_REPR_LEN else "")
    return snapshot

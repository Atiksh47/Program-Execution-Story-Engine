import threading
import copy
import types


BLOCKED_BUILTINS = {
    "open", "exec", "eval", "compile", "__import__",
    "breakpoint", "input", "print",
}

SAFE_BUILTINS = {
    k: v for k, v in __builtins__.items()
    if k not in BLOCKED_BUILTINS
} if isinstance(__builtins__, dict) else {
    k: getattr(__builtins__, k)
    for k in dir(__builtins__)
    if k not in BLOCKED_BUILTINS and not k.startswith("__")
}

SAFE_GLOBALS = {"__builtins__": SAFE_BUILTINS}


class TimeoutError(Exception):
    pass


def run_with_timeout(fn, timeout_seconds: float = 5.0):
    result = {"value": None, "error": None}

    def target():
        try:
            result["value"] = fn()
        except Exception as e:
            result["error"] = e

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout=timeout_seconds)

    if thread.is_alive():
        raise TimeoutError(f"Execution exceeded {timeout_seconds}s limit")

    if result["error"] is not None:
        raise result["error"]

    return result["value"]


_SKIP_TYPES = (
    types.FunctionType, types.MethodType, types.ModuleType,
    types.BuiltinFunctionType, types.BuiltinMethodType, type,
)


def safe_copy_locals(frame_locals: dict) -> dict:
    snapshot = {}
    for k, v in frame_locals.items():
        if k.startswith("__") or isinstance(v, _SKIP_TYPES):
            continue
        try:
            snapshot[k] = copy.deepcopy(v)
        except Exception:
            snapshot[k] = repr(v)
    return snapshot

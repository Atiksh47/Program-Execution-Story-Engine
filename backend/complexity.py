import ast
import math
import time

from backend.sandbox import SAFE_BUILTINS, run_with_timeout, TimeoutError

# Input sizes to sweep. Early-terminated if any run exceeds SLOW_MS.
SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20]
N_REPS = 5       # repetitions per size; take median
SLOW_MS = 800.0  # stop sweeping if a single run exceeds this


# ── Complexity model feature functions ───────────────────────────────────────

MODELS: list[tuple[str, object]] = [
    ("O(1)",       lambda n: 1.0),
    ("O(log n)",   lambda n: math.log2(max(n, 2))),
    ("O(n)",       lambda n: float(n)),
    ("O(n log n)", lambda n: n * math.log2(max(n, 2))),
    ("O(n²)",      lambda n: float(n * n)),
    ("O(2ⁿ)",      lambda n: min(2.0 ** n, 1e15)),
]


# ── Parameter detection ───────────────────────────────────────────────────────

def detect_sweep_param(code: str) -> str | None:
    """
    Return 'n' if the code has a module-level `n = <int>` assignment,
    or 'arr' for `arr = [...]`. Returns None if neither is found.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    for node in ast.iter_child_nodes(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not isinstance(target, ast.Name):
                continue
            name = target.id
            if name == "n" and isinstance(node.value, ast.Constant) and isinstance(node.value.value, int):
                return "n"
            if name == "arr":
                return "arr"
    return None


# ── Code injection ────────────────────────────────────────────────────────────

def inject_size(code: str, param: str, size: int) -> str:
    """Replace the first module-level `param = <value>` with the test size."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return code
    lines = code.splitlines()
    for node in ast.iter_child_nodes(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == param:
                start = node.lineno - 1
                end = getattr(node, "end_lineno", node.lineno) - 1
                if param == "n":
                    replacement = f"n = {size}"
                else:
                    replacement = f"arr = list(range({size}))"
                lines = lines[:start] + [replacement] + lines[end + 1:]
                return "\n".join(lines)
    return code


# ── Single execution timer ────────────────────────────────────────────────────

def _exec_once(compiled, safe_builtins: dict) -> float:
    """Run compiled code and return wall-clock ms. Raises on any error."""
    g = {"__builtins__": safe_builtins}
    t0 = time.perf_counter()
    exec(compiled, g)  # noqa: S102
    return (time.perf_counter() - t0) * 1000.0


def time_code(code: str, timeout_s: float = 2.0) -> float | None:
    """
    Compile and run `code` up to N_REPS times; return the median time in ms.
    Returns None on compile error, runtime error, or timeout.
    """
    try:
        compiled = compile(code, "<string>", "exec")
    except SyntaxError:
        return None

    safe_builtins = dict(SAFE_BUILTINS)
    times: list[float] = []

    for _ in range(N_REPS):
        try:
            t = run_with_timeout(
                lambda: _exec_once(compiled, safe_builtins),
                timeout_seconds=timeout_s,
            )
        except (TimeoutError, Exception):
            return None
        times.append(t)

    times.sort()
    return times[len(times) // 2]


# ── OLS fitting ───────────────────────────────────────────────────────────────

def _ols(features: list[float], y: list[float]) -> tuple[float, float, float]:
    """
    Ordinary least squares: y ≈ a + b·X (with intercept).
    Returns (a, b, r²).
    """
    n = len(features)
    if n < 2:
        return (sum(y) / max(n, 1), 0.0, 0.0)

    sx  = sum(features)
    sy  = sum(y)
    sxx = sum(f * f for f in features)
    sxy = sum(f * t for f, t in zip(features, y))

    det = n * sxx - sx * sx
    if abs(det) < 1e-20:
        a, b = sy / n, 0.0
    else:
        b = (n * sxy - sx * sy) / det
        a = (sy - b * sx) / n

    y_mean  = sy / n
    ss_res  = sum((yi - (a + b * f)) ** 2 for yi, f in zip(y, features))
    ss_tot  = sum((yi - y_mean) ** 2 for yi in y)
    r2      = 1.0 - ss_res / ss_tot if ss_tot > 1e-20 else 1.0

    return a, b, max(0.0, min(1.0, r2))


def fit_complexity(sizes: list[int], times: list[float]) -> list[tuple[str, float]]:
    """Return all models sorted by R² descending."""
    results = []
    for label, fn in MODELS:
        features = [fn(s) for s in sizes]  # type: ignore[operator]
        _, _, r2 = _ols(features, times)
        results.append((label, r2))
    results.sort(key=lambda x: x[1], reverse=True)
    return results


def best_fit_values(sizes: list[int], times: list[float], label: str) -> list[float]:
    """Return the OLS-fitted curve values at each size for the given model."""
    fn = next(f for lbl, f in MODELS if lbl == label)
    features = [fn(s) for s in sizes]  # type: ignore[operator]
    a, b, _ = _ols(features, times)
    return [max(0.0, a + b * fn(s)) for s in sizes]  # type: ignore[operator]


# ── Main entry point ──────────────────────────────────────────────────────────

def run_analysis(code: str, max_n: int = 20) -> dict | None:
    """
    Sweep n (or arr size) from SIZES up to max_n, time each run,
    fit complexity models, and return the structured result dict.
    Returns None if the code has no detectable sweep parameter or too few data points.
    """
    param = detect_sweep_param(code)
    if param is None:
        return None

    active_sizes = [s for s in SIZES if s <= max_n]
    measured_sizes: list[int] = []
    measured_times: list[float] = []

    for size in active_sizes:
        injected = inject_size(code, param, size)
        t = time_code(injected)
        if t is None:
            continue
        measured_sizes.append(size)
        measured_times.append(t)
        if t > SLOW_MS:
            break  # exponential / very slow — stop early

    if len(measured_sizes) < 4:
        return None

    fits = fit_complexity(measured_sizes, measured_times)
    best_label, best_r2 = fits[0]
    fit_vals = best_fit_values(measured_sizes, measured_times, best_label)

    return {
        "sizes":      measured_sizes,
        "times_ms":   measured_times,
        "fit_values": fit_vals,
        "best":       {"label": best_label, "r2": round(best_r2, 4)},
        "all_fits":   [{"label": lbl, "r2": round(r2, 4)} for lbl, r2 in fits],
        "param_name": param,
    }

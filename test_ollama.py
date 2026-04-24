"""Quick smoke test for Ollama connectivity and the narrator pipeline."""
import json
import sys
import time
import urllib.request
import urllib.error

OLLAMA_BASE_URL = "http://localhost:11434"
MODEL = "qwen3.5:0.8b"  # change if needed

TIMEOUT_GENERATE = 120  # seconds — bump if model is slow


def check_tags():
    print("1. Checking /api/tags and GPU info ...")
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=5) as r:
            data = json.loads(r.read())
        models = [m["name"] for m in data.get("models", [])]
        print(f"   Available models: {models}")
        if not any(MODEL.split(":")[0] in m for m in models):
            print(f"   WARNING: '{MODEL}' not found — run: ollama pull {MODEL}")
        else:
            print(f"   OK: '{MODEL}' is available.")

        # Check which GPU layers the model uses
        try:
            show_payload = json.dumps({"name": MODEL}).encode()
            req = urllib.request.Request(
                f"{OLLAMA_BASE_URL}/api/show",
                data=show_payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as r2:
                show = json.loads(r2.read())
            details = show.get("details", {})
            info = show.get("model_info", {})
            gpu_layers = info.get("llama.expert_count") or show.get("num_gpu", "?")
            print(f"   Model family: {details.get('family', '?')}, quant: {details.get('quantization_level', '?')}")
            # Look for GPU layer count in various places Ollama might report it
            gpu_info = show.get("num_gpu") or show.get("gpu_layers")
            if gpu_info is not None:
                print(f"   GPU layers: {gpu_info}")
            else:
                print("   NOTE: Could not determine GPU layer count from /api/show.")
                print("         If inference is slow, run 'ollama ps' to check if the model is GPU-loaded.")
        except Exception as e2:
            print(f"   (Could not fetch model details: {e2})")
        return True
    except Exception as e:
        print(f"   FAIL: Cannot reach Ollama at {OLLAMA_BASE_URL} — {e}")
        print("   Make sure Ollama is running: ollama serve")
        return False


def check_generate():
    print("\n2. Sending a minimal chat request (non-streaming) ...")
    payload = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": 'Reply with exactly: {"ok": true}'}],
        "stream": False,
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=TIMEOUT_GENERATE) as r:
            body = r.read().decode()
        elapsed = time.time() - t0
        obj = json.loads(body)
        content = obj.get("message", {}).get("content", "")
        print(f"   Response ({elapsed:.1f}s): {content[:200]}")
        print("   OK: non-streaming chat works.")
        return True
    except Exception as e:
        print(f"   FAIL: {e}")
        return False


def check_streaming():
    print("\n3. Sending a streaming chat request ...")
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "/no_think"},
            {"role": "user",   "content": 'Count to 3, one number per line.'},
        ],
        "stream": True,
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA_BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        chunks = 0
        full = ""
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=60) as r:
            while True:
                line = r.readline()
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
                    chunks += 1
                    full += chunk
                    sys.stdout.write(chunk)
                    sys.stdout.flush()
                if obj.get("done"):
                    break
        elapsed = time.time() - t0
        print(f"\n   Received {chunks} chunks in {elapsed:.1f}s")
        print("   OK: streaming works.")
        return True
    except Exception as e:
        print(f"\n   FAIL: {e}")
        return False


def check_narrator_pipeline():
    """Runs the actual narrator code path with a tiny fake trace."""
    print("\n4. Testing narrator pipeline with a small fake trace ...")
    # Minimal trace to keep the prompt tiny
    fake_events = [
        {"step": 0, "event": "call",   "func_name": "factorial", "line_no": 1,
         "source_line": "def factorial(n):", "locals": {"n": 3}, "depth": 1, "call_stack": []},
        {"step": 1, "event": "line",   "func_name": "factorial", "line_no": 2,
         "source_line": "  if n == 0:", "locals": {"n": 3}, "depth": 1, "call_stack": []},
        {"step": 2, "event": "return", "func_name": "factorial", "line_no": 3,
         "source_line": "  return n", "locals": {"n": 3}, "depth": 1, "call_stack": [],
         "return_value": 3},
    ]
    fake_code = "def factorial(n):\n  if n == 0: return 1\n  return n * factorial(n-1)\nprint(factorial(3))\n"

    sys.path.insert(0, ".")
    try:
        from backend.narrator import narrate_stream
        from backend.models import TraceEvent
        events = [TraceEvent(**e) for e in fake_events]
        print("   Streaming from narrator (up to 30s)...")
        chunks = 0
        done_received = False
        t0 = time.time()
        for sse_line in narrate_stream(events, fake_code):
            if not sse_line.startswith("data: "):
                continue
            payload = json.loads(sse_line[6:])
            if payload["type"] == "delta":
                chunks += 1
            elif payload["type"] == "done":
                done_received = True
                narration = payload["narration"]
                print(f"   Summary: {narration['summary'][:120]}")
                print(f"   Phases: {[p['name'] for p in narration['phases']]}")
                print(f"   Step labels count: {len(narration['step_labels'])}")
            elif payload["type"] == "error":
                print(f"   ERROR from narrator: {payload['detail']}")
                return False
        elapsed = time.time() - t0
        print(f"   Received {chunks} delta chunks in {elapsed:.1f}s")
        if done_received:
            print("   OK: full narrator pipeline works end-to-end.")
            return True
        else:
            print("   FAIL: 'done' event never received.")
            return False
    except Exception as e:
        import traceback
        print(f"   FAIL: {e}")
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print(f"Testing Ollama at {OLLAMA_BASE_URL} with model '{MODEL}'\n{'='*55}")
    results = [
        check_tags(),
        check_generate(),
        check_streaming(),
        check_narrator_pipeline(),
    ]
    print(f"\n{'='*55}")
    passed = sum(results)
    print(f"Passed {passed}/{len(results)} checks.")
    sys.exit(0 if all(results) else 1)

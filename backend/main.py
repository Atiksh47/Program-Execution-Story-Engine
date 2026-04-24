import ast
import os
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.models import TraceRequest, TraceResponse, NarrationRequest, ComplexityRequest, ComplexityResponse
from backend.tracer import trace_code
from backend.narrator import narrate_stream
from backend.sandbox import TimeoutError
from backend import database
from backend.call_tree import build_call_tree
from backend.complexity import run_analysis

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Program Execution Story Engine")

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins.strip()
    else ["http://localhost:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_check():
    database.init_db()
    from backend.narrator import OLLAMA_BASE_URL, OLLAMA_MODEL
    logger.info("Narration using Ollama model '%s' at %s", OLLAMA_MODEL, OLLAMA_BASE_URL)


@app.post("/trace", response_model=TraceResponse)
def trace_endpoint(req: TraceRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    try:
        ast.parse(req.code)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax error: {e}")

    trace_id = database.trace_id_for(req.code)

    # Return cached result if this exact code was traced before
    cached = database.get_trace(trace_id)
    if cached:
        response = TraceResponse(**cached)
        # Backfill call_tree for cache entries written before Phase B
        if response.call_tree is None:
            response.call_tree = build_call_tree(response.events)
        return response

    try:
        events, capped, stdout = trace_code(req.code)
    except TimeoutError:
        raise HTTPException(status_code=408, detail="Execution timed out (5s limit).")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not events:
        raise HTTPException(
            status_code=400,
            detail="No execution steps were recorded. Make sure your code contains executable statements.",
        )

    response = TraceResponse(
        events=events,
        total_steps=len(events),
        capped=capped,
        stdout=stdout,
        trace_id=trace_id,
        call_tree=build_call_tree(events),
    )
    database.save_trace(trace_id, req.code, response.model_dump())
    return response


@app.get("/share/{trace_id}", response_model=TraceResponse)
def share_endpoint(trace_id: str):
    data = database.get_trace(trace_id)
    if not data:
        raise HTTPException(status_code=404, detail="Trace not found.")
    response = TraceResponse(**data)
    if response.call_tree is None:
        response.call_tree = build_call_tree(response.events)
    return response


@app.post("/narrate")
def narrate_endpoint(req: NarrationRequest):
    return StreamingResponse(
        narrate_stream(req.events, req.code),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/analyze-complexity", response_model=ComplexityResponse)
def analyze_complexity_endpoint(req: ComplexityRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")
    try:
        result = run_analysis(req.code, max_n=req.max_n)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if result is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not detect a sweep parameter. "
                "Add `n = <integer>` or `arr = [...]` at module level so the analyzer "
                "knows which variable to vary."
            ),
        )
    return ComplexityResponse(**result)


@app.get("/health")
def health():
    from backend.narrator import OLLAMA_BASE_URL, OLLAMA_MODEL
    import urllib.request
    try:
        urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        ollama_ok = True
    except Exception:
        ollama_ok = False
    return {"status": "ok", "narrate_available": ollama_ok, "ollama_model": OLLAMA_MODEL}

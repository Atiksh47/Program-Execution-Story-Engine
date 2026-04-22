import ast
import os
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.models import TraceRequest, TraceResponse, NarrationRequest, NarrationResponse
from backend.tracer import trace_code
from backend.narrator import narrate
from backend.sandbox import TimeoutError

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Program Execution Story Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_check():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.warning(
            "ANTHROPIC_API_KEY is not set — the /narrate endpoint will fail. "
            "The /trace endpoint works without it."
        )


@app.post("/trace", response_model=TraceResponse)
def trace_endpoint(req: TraceRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    try:
        ast.parse(req.code)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax error: {e}")

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

    return TraceResponse(events=events, total_steps=len(events), capped=capped, stdout=stdout)


@app.post("/narrate", response_model=NarrationResponse)
def narrate_endpoint(req: NarrationRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not configured on the server.")
    try:
        return narrate(req.events, req.code)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Narration failed: {e}")


@app.get("/health")
def health():
    return {"status": "ok", "narrate_available": bool(os.environ.get("ANTHROPIC_API_KEY"))}

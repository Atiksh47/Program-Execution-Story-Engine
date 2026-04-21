from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.models import TraceRequest, TraceResponse, NarrationRequest, NarrationResponse
from backend.tracer import trace_code
from backend.narrator import narrate
from backend.sandbox import TimeoutError
import ast

app = FastAPI(title="Program Execution Story Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/trace", response_model=TraceResponse)
def trace_endpoint(req: TraceRequest):
    try:
        ast.parse(req.code)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax error: {e}")

    try:
        events, capped = trace_code(req.code)
    except TimeoutError:
        raise HTTPException(status_code=408, detail="Execution timed out (5s limit)")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return TraceResponse(events=events, total_steps=len(events), capped=capped)


@app.post("/narrate", response_model=NarrationResponse)
def narrate_endpoint(req: NarrationRequest):
    try:
        return narrate(req.events, req.code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}

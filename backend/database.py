import hashlib
import json
import os
import sqlite3
from typing import Optional

DB_PATH = os.environ.get("DB_PATH", "traces.db")


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS traces (
                id      TEXT PRIMARY KEY,
                code    TEXT NOT NULL,
                trace_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


def trace_id_for(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()[:12]


def get_trace(trace_id: str) -> Optional[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT code, trace_json FROM traces WHERE id = ?", (trace_id,)
        ).fetchone()
        if row:
            data = json.loads(row["trace_json"])
            data["code"] = row["code"]
            data["trace_id"] = trace_id
            return data
    return None


def save_trace(trace_id: str, code: str, trace_data: dict) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO traces (id, code, trace_json) VALUES (?, ?, ?)",
            (trace_id, code, json.dumps(trace_data)),
        )
        conn.commit()

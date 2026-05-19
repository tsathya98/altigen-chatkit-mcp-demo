"""FastAPI app for the Altigen Pharma demo.

Exposes:
  * REST /api/products, /api/trials, /api/kpis      → dashboard data
  * POST /chatkit                                   → ChatKit transport
  * POST /api/voice/realtime-token                  → ephemeral key for the
                                                       OpenAI Realtime API
                                                       (frontend connects
                                                       directly to OpenAI)

Run:
    uv run uvicorn chat_backend.main:app --reload
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from chatkit.server import StreamingResult
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from chat_backend.activity import hub as activity_hub
from chat_backend.chat_server import AltigenServer

load_dotenv()

DB_PATH = Path(os.getenv("PHARMA_DB", "data/pharma.db")).resolve()
REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")


# ---------------------------------------------------------------------------
# Lifespan — start/stop the agent's MCP connection alongside the app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    server = AltigenServer()
    await server.aconnect()
    app.state.chat = server
    try:
        yield
    finally:
        await server.aclose()


app = FastAPI(title="Altigen Pharma demo backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_chat(request: Request) -> AltigenServer:
    return request.app.state.chat


# ---------------------------------------------------------------------------
# DB helper
# ---------------------------------------------------------------------------

def query(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


# ---------------------------------------------------------------------------
# REST: dashboard data
# ---------------------------------------------------------------------------

@app.get("/api/products")
def products() -> list[dict[str, Any]]:
    return query("SELECT name, indication, therapy_area, status, launch_year FROM products ORDER BY name")


@app.get("/api/trials")
def trials() -> list[dict[str, Any]]:
    return query(
        """
        SELECT t.trial_id, p.name AS product, t.phase, t.status,
               t.enrollment_target, t.enrollment_actual,
               t.start_date, t.primary_endpoint
        FROM clinical_trials t
        JOIN products p USING (product_id)
        ORDER BY t.start_date DESC
        """
    )


@app.get("/api/kpis")
def kpis(period: str | None = None) -> list[dict[str, Any]]:
    if period:
        return query(
            "SELECT name, function, period, value, unit, target FROM kpis WHERE period = ? ORDER BY function, name",
            (period,),
        )
    return query("SELECT name, function, period, value, unit, target FROM kpis ORDER BY period, function, name")


# ---------------------------------------------------------------------------
# ChatKit transport — single endpoint, ChatKit handles routing internally
# ---------------------------------------------------------------------------

@app.post("/chatkit")
async def chatkit(request: Request, server: AltigenServer = Depends(get_chat)):
    """ChatKit transport endpoint.

    The wire format is a single POST that returns either:
      • SSE-streamed bytes (when respond() yields events)  — StreamingResult is
        itself AsyncIterable[bytes].
      • A JSON blob (for non-streaming actions) — NonStreamingResult.json holds
        the already-serialized bytes.
    """
    body = await request.body()
    context = dict(request.headers)
    result = await server.process(body, context)
    if isinstance(result, StreamingResult):
        return StreamingResponse(result, media_type="text/event-stream")
    return Response(content=result.json, media_type="application/json")


# ---------------------------------------------------------------------------
# Voice: mint an ephemeral key so the browser can talk to Realtime API directly
# ---------------------------------------------------------------------------

@app.post("/api/voice/realtime-token")
async def realtime_token() -> dict[str, Any]:
    """Mint an ephemeral client_secret for the browser's Realtime WebRTC session.

    GA endpoint (2026): POST /v1/realtime/client_secrets — the older
    /v1/realtime/sessions and OpenAI-Beta header are gone.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(500, "OPENAI_API_KEY missing")
    voice = os.getenv("OPENAI_REALTIME_VOICE", "marin")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "session": {
                    "type": "realtime",
                    "model": REALTIME_MODEL,
                    "audio": {"output": {"voice": voice}},
                }
            },
        )
        r.raise_for_status()
        return r.json()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Activity stream — live MCP / RAG / tool-call telemetry, server-sent events.
#
# The frontend opens an EventSource to this URL and renders a floating panel
# that shows the agent's tool calls and vector-store searches in real time.
# ---------------------------------------------------------------------------

@app.get("/api/activity/stream")
async def activity_stream() -> StreamingResponse:
    return StreamingResponse(
        activity_hub.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # disable nginx-style buffering
        },
    )


@app.post("/api/activity/push")
async def activity_push(request: Request) -> dict[str, str]:
    """Browser-side tools (navigate / dashboard mutations) post here so they
    appear inline with the server-emitted MCP events."""
    body = await request.json()
    kind = body.get("kind", "tool_call")
    payload = {k: v for k, v in body.items() if k != "kind"}
    await activity_hub.publish(kind, **payload)
    return {"ok": "true"}


# ---------------------------------------------------------------------------
# MCP introspection — list the tools, resources, and prompts the agent has.
# Used by the Command Palette and the MCP Inspector panel.
# ---------------------------------------------------------------------------

@app.get("/api/mcp/manifest")
async def mcp_manifest(server: AltigenServer = Depends(get_chat)) -> dict[str, Any]:
    """Return a JSON manifest of the MCP server's surface area.

    We don't want to re-implement MCP introspection — the Agents SDK already
    has the connection, so we ask it for its tools list and pass it through.
    """
    manifest: dict[str, Any] = {"servers": []}
    for srv in server._mcp_servers:
        try:
            tools = await srv.list_tools()
        except Exception:
            tools = []
        manifest["servers"].append(
            {
                "name": getattr(srv, "name", "mcp"),
                "tools": [
                    {
                        "name": getattr(t, "name", None),
                        "description": getattr(t, "description", None),
                        "inputSchema": getattr(t, "inputSchema", None),
                    }
                    for t in tools
                ],
            }
        )
    return manifest

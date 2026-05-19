"""Live agent activity event bus.

A single in-process pub/sub that the chat server pushes into whenever the
agent invokes a tool (MCP or otherwise) or queries the vector store, and
that the SSE endpoint in main.py streams to the browser.

Deliberately tiny — one global Hub, asyncio.Queue per subscriber, no
persistence. Drops the oldest event past a small cap to stay bounded.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections import deque
from typing import Any, AsyncIterator, Literal


EventKind = Literal[
    "tool_call",        # any tool was invoked
    "tool_result",      # tool returned
    "mcp_call",         # MCP-flavoured tool (separated for nicer UI labels)
    "mcp_result",
    "rag_query",        # FileSearchTool against the vector store
    "rag_result",
    "agent_thinking",   # reasoning / planning hint
    "agent_message",    # final agent message arrived
    "user_message",     # browser→server text
    "info",             # system marker, e.g. "session started"
]


class ActivityHub:
    BACKLOG = 60  # how many recent events new subscribers see on connect

    def __init__(self) -> None:
        self._recent: deque[dict[str, Any]] = deque(maxlen=self.BACKLOG)
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = asyncio.Lock()

    async def publish(self, kind: EventKind, **payload: Any) -> dict[str, Any]:
        event = {
            "id": uuid.uuid4().hex[:10],
            "kind": kind,
            "ts": time.time(),
            **payload,
        }
        async with self._lock:
            self._recent.append(event)
            dead: list[asyncio.Queue[dict[str, Any]]] = []
            for q in self._subscribers:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    dead.append(q)
            for q in dead:
                self._subscribers.discard(q)
        return event

    def publish_sync(self, kind: EventKind, **payload: Any) -> None:
        """Fire-and-forget from sync code. Safe to call from non-async contexts."""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            return
        if loop.is_running():
            loop.create_task(self.publish(kind, **payload))

    async def subscribe(self) -> AsyncIterator[bytes]:
        """SSE generator. Replays the recent backlog, then streams live events."""
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.add(q)
            backlog = list(self._recent)
        try:
            yield b": connected\n\n"
            for ev in backlog:
                yield _sse(ev)
            while True:
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield _sse(ev)
                except asyncio.TimeoutError:
                    yield b": ping\n\n"
        finally:
            async with self._lock:
                self._subscribers.discard(q)


def _sse(event: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(event, default=str)}\n\n".encode("utf-8")


# Single process-wide hub. main.py re-exports for convenience.
hub = ActivityHub()

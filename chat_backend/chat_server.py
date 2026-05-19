"""Self-hosted ChatKit server for the Altigen Pharma agent.

Mirrors the reference repo's pattern (`AssistantServer(ChatKitServer[...])`)
but stripped to the essentials: in-memory store, one agent, streaming
responses via `stream_agent_response`, plus a `transcribe()` override
that proxies to OpenAI's audio API.
"""

from __future__ import annotations

import logging
from typing import Any

from agents import Runner
from chatkit.agents import AgentContext, simple_to_agent_input, stream_agent_response
from chatkit.server import ChatKitServer
from chatkit.types import TranscriptionResult
from openai import AsyncOpenAI

from chat_backend.activity import hub
from chat_backend.agent_definition import build_agent
from chat_backend.store import InMemoryStore

LOGGER = logging.getLogger(__name__)


class AltigenServer(ChatKitServer[dict[str, Any]]):
    """Single-agent ChatKit server. One MCP server, one vector store, one model."""

    def __init__(self) -> None:
        super().__init__(InMemoryStore())
        self.agent, self._mcp_servers = build_agent()
        self._openai = AsyncOpenAI()

    async def aconnect(self) -> None:
        for srv in self._mcp_servers:
            await srv.connect()

    async def aclose(self) -> None:
        for srv in self._mcp_servers:
            await srv.cleanup()

    async def respond(self, thread, input_user_message, context):
        """Stream a turn back to the client.

        Canonical ChatKit ↔ Agents-SDK glue:
          1. Load the most recent slice of thread items from the store.
          2. Convert them (plus the new user message) into Agents-SDK input.
          3. Run the agent in streaming mode.
          4. Re-emit each Agents event as a ChatKit ThreadStreamEvent.
        """
        items_page = await self.store.load_thread_items(
            thread.id, after=None, limit=20, order="desc", context=context,
        )
        items = list(reversed(items_page.data))
        if input_user_message is not None and not any(
            getattr(it, "id", None) == input_user_message.id for it in items
        ):
            items.append(input_user_message)

        # Surface the user's question to the activity stream.
        if input_user_message is not None:
            await hub.publish(
                "user_message",
                text=_extract_user_text(input_user_message),
                thread_id=getattr(thread, "id", None),
            )

        agent_input = await simple_to_agent_input(items)

        agent_context = AgentContext(
            thread=thread, store=self.store, request_context=context,
        )

        result = Runner.run_streamed(self.agent, agent_input, context=agent_context)
        in_flight: dict[str, dict[str, Any]] = {}
        async for event in stream_agent_response(agent_context, result):
            try:
                await _emit_activity(event, in_flight)
            except Exception as e:  # never let telemetry break the response
                LOGGER.debug("activity emit failed: %s", e)
            yield event

    async def transcribe(self, audio_input, context: dict[str, Any]) -> TranscriptionResult:
        """Dictation for ChatKit's mic button — defaults to gpt-4o-transcribe."""
        import os

        response = await self._openai.audio.transcriptions.create(
            file=("voice", audio_input.data, audio_input.mime_type),
            model=os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe"),
        )
        return TranscriptionResult(text=response.text)


# ---------------------------------------------------------------------------
# Activity extraction
#
# The Agents-SDK ↔ ChatKit bridge yields a heterogeneous stream of events.
# We sniff each one for the things we want to *show* on the activity panel:
# tool calls (MCP + client tools), vector-store searches, reasoning hints,
# and final messages. Unknown shapes are skipped — this is best-effort
# telemetry, not a contract.
# ---------------------------------------------------------------------------

_MCP_TOOL_NAMES = {"list_products", "get_trial_status", "get_kpi", "kpi_trend"}


def _extract_user_text(item: Any) -> str:
    """Best-effort: pull the text out of a ChatKit user message."""
    content = getattr(item, "content", None)
    if isinstance(content, list):
        parts: list[str] = []
        for c in content:
            txt = getattr(c, "text", None) or (c.get("text") if isinstance(c, dict) else None)
            if isinstance(txt, str):
                parts.append(txt)
        if parts:
            return " ".join(parts).strip()
    if isinstance(content, str):
        return content.strip()
    return ""


def _coerce(obj: Any) -> Any:
    """Recursively turn pydantic models / dataclasses into plain dicts."""
    if isinstance(obj, dict):
        return {k: _coerce(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_coerce(v) for v in obj]
    if hasattr(obj, "model_dump") and callable(obj.model_dump):
        try:
            return obj.model_dump()
        except Exception:
            pass
    if hasattr(obj, "__dict__"):
        return {k: _coerce(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    return obj


def _shorten(payload: Any, limit: int = 360) -> Any:
    """Compact a result preview so it doesn't blow up the wire."""
    try:
        if isinstance(payload, list):
            return [_shorten(x, limit) for x in payload[:6]]
        if isinstance(payload, dict):
            return {k: _shorten(v, limit) for k, v in list(payload.items())[:12]}
        if isinstance(payload, str) and len(payload) > limit:
            return payload[:limit] + "…"
    except Exception:
        return None
    return payload


async def _emit_activity(event: Any, in_flight: dict[str, dict[str, Any]]) -> None:
    """Look at one bridge event and emit zero-or-more activity entries."""
    et = getattr(event, "type", None)
    if not et:
        # ChatKit-side ThreadStreamEvent: peek at .event_type / .item
        et = getattr(event, "event_type", None)

    # Agents-SDK raw events come through as RawResponsesStreamEvent /
    # RunItemStreamEvent / ToolCallItem / ToolCallOutputItem etc.
    # We attempt several shapes — whatever sticks.

    # 1) Tool call started.
    item = getattr(event, "item", None) or getattr(event, "data", None)
    name = getattr(item, "name", None) or getattr(item, "tool_name", None)
    call_id = (
        getattr(item, "call_id", None)
        or getattr(item, "id", None)
        or getattr(event, "call_id", None)
    )
    raw_args = getattr(item, "arguments", None) or getattr(item, "input", None)

    if name and call_id and call_id not in in_flight:
        kind = "mcp_call" if name in _MCP_TOOL_NAMES else "tool_call"
        if name in {"file_search", "FileSearchTool"}:
            kind = "rag_query"
        in_flight[call_id] = {"name": name, "kind": kind, "started": True}
        await hub.publish(
            kind,
            name=name,
            call_id=call_id,
            arguments=_shorten(_coerce(raw_args)),
        )
        return

    # 2) Tool result. ChatKit's RunItemStreamEvent wraps a ToolCallOutputItem.
    output = (
        getattr(item, "output", None)
        or getattr(event, "output", None)
        or getattr(item, "result", None)
    )
    if call_id and call_id in in_flight and output is not None:
        meta = in_flight.pop(call_id)
        result_kind = "rag_result" if meta["kind"] == "rag_query" else (
            "mcp_result" if meta["kind"] == "mcp_call" else "tool_result"
        )
        await hub.publish(
            result_kind,
            name=meta["name"],
            call_id=call_id,
            result=_shorten(_coerce(output)),
        )
        return

    # 3) Final assistant message — only emit once we have a non-empty draft.
    if et and "message" in str(et).lower() and getattr(event, "item", None):
        msg_item = event.item
        msg_text = ""
        content = getattr(msg_item, "content", None)
        if isinstance(content, list):
            for c in content:
                t = getattr(c, "text", None)
                if isinstance(t, str):
                    msg_text += t
        if msg_text:
            await hub.publish("agent_message", text=_shorten(msg_text, 600))

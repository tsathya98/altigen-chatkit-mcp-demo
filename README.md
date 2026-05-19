# Altigen Pharma — ChatKit × MCP × Realtime Demo

A polished operations console that showcases what a modern agentic
application looks like when ChatKit, MCP, and the Realtime API all sit on
the same stage. Live MCP tool inspector, a ⌘K command palette, half-circle
gauges, sparklines, heatmaps, drag-and-drop sandbox dashboards, voice mode
with a reactive waveform — and an agent that can build any of it for you.

## What's inside

- **Live MCP / RAG activity panel** — a floating bottom-left widget that
  surfaces every MCP tool call and vector-store search the agent makes,
  in real time, with arguments + results expandable inline. Backed by a
  pub/sub bus in `chat_backend/activity.py` and SSE at
  `/api/activity/stream`.
- **Command Palette (⌘K)** — fuzzy search over KPIs, products, trials,
  AI prompts, dashboard templates, and navigation. `↩` runs, `⌘↩` prefills
  the chat composer instead.
- **Sandbox editor with drag-and-drop** — agent or user composes a custom
  dashboard from 9 widget kinds: KPI card, gauge, sparkline, area trend,
  function × period heatmap, side-by-side comparison, products grid,
  clinical-trials grid, markdown note.
- **Voice mode with live waveform** — WebRTC directly to OpenAI's Realtime
  API; mic RMS drives a 5-bar coral waveform next to the Stop button.
- **MCP introspection** — `GET /api/mcp/manifest` returns the live tool
  list the Agents SDK pulled from the MCP server.

## Architecture

```
┌──────────────┐   /api/* + /chatkit   ┌──────────────────┐  Streamable HTTP   ┌─────────────────┐
│ Next.js 15   │ ───────────────────► │ FastAPI backend  │ ─────────────────► │ FastMCP 3.0     │
│ (port 3000)  │                       │  (port 8000)     │                     │ (port 9000)     │
│  ChatKit     │                       │  Agents SDK +    │                     │  3 tools, 1     │
│  Recharts    │ ──── WebRTC ────────► │  Vector Store    │                     │  resource, 1    │
│  Voice mode  │     (OpenAI direct)   │                  │                     │  prompt         │
└──────────────┘                       └─────────┬────────┘                     └────────┬────────┘
                                                  │                                      │
                                                  ▼                                      ▼
                                        OpenAI Vector Store                       SQLite (3 tables)
                                          (RAG over labels)                       products / trials / kpis
```

## Prerequisites

- `uv` (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Node 20+ and `pnpm` or `npm`
- An `OPENAI_API_KEY`

## One-time setup

```bash
cd demo
cp .env.example .env                 # paste your OPENAI_API_KEY here
uv sync                              # backend deps

uv run python scripts/seed.py                       # SQLite + 3 RAG docs
uv run python scripts/bootstrap_vector_store.py     # uploads docs → OpenAI Vector Store
                                                     # writes data/vector_store_id.txt

cd frontend
npm install
cp .env.local.example .env.local
```

## Run (3 terminals)

```bash
# 1) MCP server
uv run python -m mcp_server.server

# 2) FastAPI backend
uv run uvicorn chat_backend.main:app --reload

# 3) Next.js frontend
cd frontend && npm run dev
```

Open http://localhost:3000.

## On-stage script

| Move | Question to ask | What it shows |
| --- | --- | --- |
| 1 | "What products do we have in Cardiology?" | MCP tool `list_products` with a filter, rendered as a DataGrid widget |
| 2 | "How is Zenoxitam revenue trending?" | MCP tool `kpi_trend` → line chart widget |
| 3 | "What's our right-first-time?" | Agent calls the `ask_for_missing_filters` MCP prompt — period is missing |
| 4 | (after answering "2026-Q1") | Single Card widget with target delta |
| 5 | "Summarize the prescribing info for Zenoxitam." | OpenAI Vector Store `file_search` on the mock label |
| 6 | Hit *Voice mode* | Browser ↔ OpenAI Realtime over WebRTC; ephemeral key minted by `/api/voice/realtime-token` |

## Layout

```
demo/
├── mcp_server/server.py           # FastMCP 3.0 — 3 tools + 1 resource + 1 prompt
├── chat_backend/
│   ├── agent_definition.py        # Agent (model, instructions, MCP, FileSearchTool)
│   ├── chat_server.py             # ChatKitServer subclass + transcribe()
│   ├── widgets.py                 # KPI card / chart / table / form descriptors
│   └── main.py                    # FastAPI: REST + /chatkit + voice/realtime-token
├── frontend/                      # Next.js 15 + React 19 + Tailwind 4 + ChatKit
└── scripts/
    ├── seed.py                    # SQLite + markdown corpus
    └── bootstrap_vector_store.py  # one-shot vector-store creation
```

## Why this shape

- **One MCP server** (not nine like prod) — the topology, not the org chart, is what matters for the talk.
- **MemoryStore** (not DynamoDB) — the moving parts you care about are the agent loop and the MCP wire, not state durability.
- **OpenAI Vector Store** instead of FAISS — one less dependency, one less knob, and `FileSearchTool` is the canonical Agents-SDK pattern.
- **Realtime via ephemeral key** — the browser never proxies audio through our backend, so the latency story is honest.

## Versions pinned (Apr 2026)

| Component | Version | Notes |
| --- | --- | --- |
| Model | `gpt-5.5` | `reasoning.effort=low` to keep the demo snappy on stage |
| Realtime | `gpt-realtime` | voice-mode model |
| Transcription | `gpt-4o-transcribe` | ChatKit dictation |
| `fastmcp` | ≥ 3.2.4 | streamable HTTP, component versioning available |
| `openai-agents` | ≥ 0.14.8 | `MCPServerStreamableHttp`, `FileSearchTool`, sandbox-agents beta |
| `openai-chatkit` | ≥ 1.6.3 | Python backend SDK (`ChatKitServer`, `MemoryStore`) |
| `@openai/chatkit-react` | ^ 1.5.0 | self-hosted requires `domainKey` in `useChatKit({api})` |

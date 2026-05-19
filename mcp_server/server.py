"""Altigen Pharma MCP server.

A single FastMCP 3.0 server that exposes:
  * tools     — read-only NLQ-style queries against a SQLite mock store
  * resource  — the database schema + a domain glossary, addressable by URI
  * prompt    — a clarification template the agent can render when key
                filters are missing

Run:
    uv run python -m mcp_server.server
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

from fastmcp import FastMCP
from pydantic import BaseModel, Field

DB_PATH = Path(os.getenv("PHARMA_DB", "data/pharma.db")).resolve()

mcp = FastMCP(
    name="altigen-pharma-mcp",
    instructions=(
        "Read-only access to Altigen Pharma's mock operational data. "
        "Always prefer structured tools over free-form SQL. "
        "When a question lacks a required filter (period, product, function), "
        "render the 'ask_for_missing_filters' prompt instead of guessing."
    ),
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _rows(cursor: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(row) for row in cursor.fetchall()]


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

class ProductFilter(BaseModel):
    therapy_area: str | None = Field(None, description="e.g. Cardiology, Oncology")
    status: str | None = Field(None, description="e.g. Marketed, Phase III")


@mcp.tool(
    name="list_products",
    description="List Altigen Pharma products, optionally filtered by therapy area or development status.",
    tags={"pharma", "catalog", "read-only"},
)
def list_products(filters: ProductFilter | None = None) -> list[dict[str, Any]]:
    filters = filters or ProductFilter()
    sql = "SELECT name, indication, therapy_area, status, launch_year FROM products WHERE 1=1"
    params: list[Any] = []
    if filters.therapy_area:
        sql += " AND therapy_area = ?"
        params.append(filters.therapy_area)
    if filters.status:
        sql += " AND status = ?"
        params.append(filters.status)
    sql += " ORDER BY name"
    with _connect() as conn:
        return _rows(conn.execute(sql, params))


@mcp.tool(
    name="get_trial_status",
    description="Return clinical trial details for a given product name (case-insensitive substring match).",
    tags={"pharma", "clinical-trials"},
)
def get_trial_status(product_name: str) -> list[dict[str, Any]]:
    sql = """
        SELECT t.trial_id, p.name AS product, t.phase, t.status,
               t.enrollment_target, t.enrollment_actual,
               t.start_date, t.primary_endpoint
        FROM clinical_trials t
        JOIN products p ON p.product_id = t.product_id
        WHERE LOWER(p.name) LIKE ?
        ORDER BY t.start_date DESC
    """
    with _connect() as conn:
        return _rows(conn.execute(sql, (f"%{product_name.lower()}%",)))


@mcp.tool(
    name="get_kpi",
    description=(
        "Look up a KPI value. Both `name` and `period` are required. "
        "If either is missing, the agent should call the 'ask_for_missing_filters' prompt instead."
    ),
    tags={"pharma", "kpi"},
)
def get_kpi(name: str, period: str, function: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT name, function, period, value, unit, target FROM kpis WHERE LOWER(name) LIKE ? AND period = ?"
    params: list[Any] = [f"%{name.lower()}%", period]
    if function:
        sql += " AND function = ?"
        params.append(function)
    with _connect() as conn:
        return _rows(conn.execute(sql, params))


@mcp.tool(
    name="kpi_trend",
    description="Return all available periods for a KPI (used to render trend charts).",
    tags={"pharma", "kpi", "trend"},
)
def kpi_trend(name: str, function: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT name, function, period, value, unit, target FROM kpis WHERE LOWER(name) LIKE ?"
    params: list[Any] = [f"%{name.lower()}%"]
    if function:
        sql += " AND function = ?"
        params.append(function)
    sql += " ORDER BY period"
    with _connect() as conn:
        return _rows(conn.execute(sql, params))


# ---------------------------------------------------------------------------
# Resource
# ---------------------------------------------------------------------------

@mcp.resource(
    uri="pharma://schema",
    name="Altigen pharma schema & glossary",
    description="Structured description of every table the agent can query, plus a short domain glossary.",
    mime_type="text/markdown",
)
def schema_resource() -> str:
    return """# Altigen Pharma — Schema & Glossary

## Tables

- **products** (`name`, `indication`, `therapy_area`, `status`, `launch_year`) — every commercial or pipeline asset.
- **clinical_trials** (`trial_id`, `product_id`, `phase`, `status`, `enrollment_target`, `enrollment_actual`, `start_date`, `primary_endpoint`).
- **kpis** (`name`, `function` ∈ {Clinical Operations, Manufacturing, Pharmacovigilance, Commercial, R&D}, `period` like `2026-Q1`, `value`, `unit`, `target`).

## Glossary

- **HFrEF** — Heart failure with reduced ejection fraction.
- **PASI-75** — ≥75% improvement in Psoriasis Area and Severity Index, the standard efficacy threshold for moderate-to-severe psoriasis.
- **PFS** — Progression-free survival (oncology primary endpoint).
- **Right-first-time** — Manufacturing batches released without deviation. Target: ≥98%.

## Routing hints

- For a *trend* question ("how is X changing"), call `kpi_trend` once — it returns every period.
- For a *single-period* question, call `get_kpi`. If `period` is missing, render the `ask_for_missing_filters` prompt.
- For a *catalog* question ("what do we sell in X"), use `list_products` with a `therapy_area` filter.
"""


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

@mcp.prompt(
    name="ask_for_missing_filters",
    description=(
        "Render a clarification message when a required KPI filter is missing. "
        "Use this instead of guessing a default period or function."
    ),
    tags={"clarification"},
)
def ask_for_missing_filters(kpi_name: str, missing: list[str]) -> str:
    pretty = ", ".join(missing)
    return (
        f"To look up **{kpi_name}** I still need: **{pretty}**. "
        "Could you tell me which period (e.g. 2026-Q1) and, if relevant, which function "
        "(Clinical Operations, Manufacturing, Pharmacovigilance, Commercial, R&D) you have in mind?"
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    host = os.getenv("MCP_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_PORT", "9000"))
    path = os.getenv("MCP_PATH", "/mcp")
    if not DB_PATH.exists():
        raise SystemExit(
            f"Database not found at {DB_PATH}. Run `uv run python scripts/seed.py` first."
        )
    mcp.run(transport="http", host=host, port=port, path=path)


if __name__ == "__main__":
    main()

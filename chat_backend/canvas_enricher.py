"""Server-side enrichment of `altigen-chart` fences.

The agent writes minimal chart specs in its markdown — e.g.:

    ```altigen-chart
    { "kind": "trend", "kpiName": "Net product revenue (Zenoxitam)", "variant": "line" }
    ```

This module scans the markdown for those fences, pulls the actual data
out of pharma.db (the same source the MCP server queries), and rewrites
each fence with the resolved data embedded. The frontend then renders
straight from the inline payload — no second round-trip — so the canvas
content really is the single source of truth.

Keeps the agent's tool surface tiny (it just names a KPI) while the
chart still ships with real numbers.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(os.getenv("PHARMA_DB", "data/pharma.db")).resolve()

# Triple-backtick fence with language tag "altigen-chart".
# Captures the body between the opening and closing fences. Non-greedy.
_FENCE = re.compile(
    r"```altigen-chart\s*\n(?P<body>.*?)\n```",
    re.DOTALL,
)


def enrich(content: str) -> str:
    """Walk `content` and rewrite every altigen-chart fence with DB data.

    Failing to parse or look up a fence leaves it untouched (frontend
    will still get the original spec and can show its own fallback).
    """
    if not content or "altigen-chart" not in content:
        return content

    def replace(m: re.Match[str]) -> str:
        raw = m.group("body").strip()
        try:
            spec = json.loads(raw)
        except json.JSONDecodeError:
            return m.group(0)
        if not isinstance(spec, dict) or not isinstance(spec.get("kind"), str):
            return m.group(0)
        try:
            enriched = _enrich_spec(spec)
        except Exception:
            return m.group(0)
        body = json.dumps(enriched, ensure_ascii=False)
        return f"```altigen-chart\n{body}\n```"

    return _FENCE.sub(replace, content)


# ---------------------------------------------------------------------------
# Per-kind enrichment
# ---------------------------------------------------------------------------

def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _kpi_series(name: str) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT name, function, period, value, unit, target "
            "FROM kpis WHERE LOWER(name) LIKE ? ORDER BY period",
            (f"%{name.lower()}%",),
        ).fetchall()
    return [dict(r) for r in rows]


def _kpi_at(name: str, period: str | None) -> dict[str, Any] | None:
    period = period or "2026-Q1"
    with _connect() as conn:
        row = conn.execute(
            "SELECT name, function, period, value, unit, target "
            "FROM kpis WHERE LOWER(name) LIKE ? AND period = ? LIMIT 1",
            (f"%{name.lower()}%", period),
        ).fetchone()
    return dict(row) if row else None


def _all_kpis() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT name, function, period, value, unit, target FROM kpis"
        ).fetchall()
    return [dict(r) for r in rows]


def _products(therapy_area: str | None) -> list[dict[str, Any]]:
    sql = "SELECT name, indication, therapy_area, status, launch_year FROM products"
    params: list[Any] = []
    if therapy_area:
        sql += " WHERE LOWER(therapy_area) = ?"
        params.append(therapy_area.lower())
    sql += " ORDER BY name"
    with _connect() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def _trials(
    product_name: str | None, phase: str | None, status: str | None
) -> list[dict[str, Any]]:
    sql = (
        "SELECT t.trial_id, p.name AS product, t.phase, t.status, "
        "t.enrollment_target, t.enrollment_actual, t.start_date, t.primary_endpoint "
        "FROM clinical_trials t JOIN products p ON p.product_id = t.product_id"
    )
    where: list[str] = []
    params: list[Any] = []
    if product_name:
        where.append("LOWER(p.name) LIKE ?")
        params.append(f"%{product_name.lower()}%")
    if phase:
        where.append("t.phase = ?")
        params.append(phase)
    if status:
        where.append("LOWER(t.status) = ?")
        params.append(status.lower())
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY t.start_date DESC"
    with _connect() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def _enrich_spec(spec: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of spec with `data`/`series`/`rows` populated."""
    kind = spec["kind"]
    out = dict(spec)

    if kind in ("trend", "sparkline"):
        kpi_name = spec.get("kpiName")
        if not kpi_name:
            return out
        series = _kpi_series(kpi_name)
        if series:
            out["unit"] = series[0]["unit"]
            out["function"] = series[0]["function"]
            out["target"] = series[-1].get("target")
            out["data"] = [
                {"period": r["period"], "value": r["value"]} for r in series
            ]
        return out

    if kind in ("kpi", "gauge"):
        kpi_name = spec.get("kpiName")
        if not kpi_name:
            return out
        row = _kpi_at(kpi_name, spec.get("period"))
        if row:
            out["value"]    = row["value"]
            out["unit"]     = row["unit"]
            out["target"]   = row["target"]
            out["function"] = row["function"]
            out["period"]   = row["period"]
        return out

    if kind == "compare":
        names = spec.get("kpiNames") or []
        period = spec.get("period") or "2026-Q1"
        rows: list[dict[str, Any]] = []
        for n in names:
            r = _kpi_at(n, period)
            if r:
                rows.append(
                    {
                        "name": r["name"],
                        "value": r["value"],
                        "target": r["target"],
                        "unit": r["unit"],
                    }
                )
        out["data"] = rows
        out["period"] = period
        return out

    if kind == "heatmap":
        kpis = _all_kpis()
        if spec.get("function_"):
            target = spec["function_"].lower()
            kpis = [k for k in kpis if k["function"].lower() == target]
        out["data"] = kpis
        return out

    if kind == "products":
        out["data"] = _products(spec.get("therapyArea"))
        return out

    if kind == "trials":
        out["data"] = _trials(
            spec.get("productName"), spec.get("phase"), spec.get("status")
        )
        return out

    # kind == "note" or unknown — pass through unchanged
    return out

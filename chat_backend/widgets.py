"""ChatKit widget builders for the Altigen Pharma agent.

Widgets are JSON descriptors that ChatKit's React component renders
inline in the conversation — KPI cards, trend charts, product tables,
clarification forms. Each builder takes raw tool output and returns the
structured dict ChatKit understands.

Schemas follow ChatKit's widget primitive set (Card, Markdown, DataGrid,
Chart, Form, Action). If your installed ChatKit version uses slightly
different keys, the builders are isolated here so you only patch one
file.
"""

from __future__ import annotations

from typing import Any


def kpi_card(row: dict[str, Any]) -> dict[str, Any]:
    """A single-period KPI value card."""
    delta = None
    if row.get("target") is not None:
        delta = round(row["value"] - row["target"], 2)
    return {
        "type": "Card",
        "title": row["name"],
        "subtitle": f"{row['function']} • {row['period']}",
        "headline": f"{row['value']} {row['unit']}",
        "footnote": (
            f"Target {row['target']} {row['unit']} ({'+' if (delta or 0) >= 0 else ''}{delta})"
            if delta is not None
            else None
        ),
        "tone": _tone_for(row),
    }


def kpi_trend_chart(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """A line chart of one KPI across periods."""
    if not rows:
        return {"type": "Markdown", "value": "_No KPI data found._"}
    return {
        "type": "Chart",
        "variant": "line",
        "title": rows[0]["name"],
        "subtitle": rows[0]["function"],
        "xKey": "period",
        "yKey": "value",
        "data": [{"period": r["period"], "value": r["value"]} for r in rows],
        "annotations": [{"type": "target", "value": rows[0].get("target")}],
    }


def products_table(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """A DataGrid of products."""
    return {
        "type": "DataGrid",
        "title": "Altigen Pharma — products",
        "columns": [
            {"key": "name", "label": "Product"},
            {"key": "indication", "label": "Indication"},
            {"key": "therapy_area", "label": "Therapy area"},
            {"key": "status", "label": "Status"},
            {"key": "launch_year", "label": "Launched"},
        ],
        "rows": rows,
    }


def trials_table(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """A DataGrid of clinical trials."""
    enriched = [
        {
            **r,
            "enrollment": (
                f"{r['enrollment_actual']}/{r['enrollment_target']} "
                f"({round(100 * r['enrollment_actual'] / r['enrollment_target'])}%)"
            ),
        }
        for r in rows
    ]
    return {
        "type": "DataGrid",
        "title": "Clinical trials",
        "columns": [
            {"key": "trial_id", "label": "Trial"},
            {"key": "product", "label": "Product"},
            {"key": "phase", "label": "Phase"},
            {"key": "status", "label": "Status"},
            {"key": "enrollment", "label": "Enrolled"},
            {"key": "primary_endpoint", "label": "Primary endpoint"},
        ],
        "rows": enriched,
    }


def clarify_form(missing: list[str]) -> dict[str, Any]:
    """A small form the user fills in to provide missing filter values."""
    return {
        "type": "Form",
        "title": "Tell me a bit more",
        "submitLabel": "Run query",
        "fields": [
            {"name": field, "label": field.replace("_", " ").title(), "required": True}
            for field in missing
        ],
    }


def _tone_for(row: dict[str, Any]) -> str:
    target = row.get("target")
    if target is None:
        return "neutral"
    if row["value"] >= target:
        return "positive"
    if row["value"] >= target * 0.95:
        return "warning"
    return "critical"

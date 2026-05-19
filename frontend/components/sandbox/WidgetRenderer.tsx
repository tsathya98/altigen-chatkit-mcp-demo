"use client";

import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { useState } from "react";
import {
  moveWidget,
  removeWidget,
  reorderWidgets,
  type Widget,
} from "@/lib/sandbox-store";
import type { Kpi, Product, Trial } from "@/lib/api";
import { TrendChart } from "../TrendChart";
import { Compare } from "./widgets/Compare";
import { Gauge } from "./widgets/Gauge";
import { Heatmap } from "./widgets/Heatmap";
import { Sparkline } from "./widgets/Sparkline";

type Props = Readonly<{
  widget: Widget;
  index: number;
  total: number;
  products?: Product[];
  trials?: Trial[];
  kpis?: Kpi[];
}>;

function tone(k: Kpi): "positive" | "warning" | "critical" | "neutral" {
  if (k.target == null) return "neutral";
  if (k.value >= k.target) return "positive";
  if (k.value >= k.target * 0.95) return "warning";
  return "critical";
}

export function WidgetRenderer({ widget, index, total, products, trials, kpis }: Props) {
  let body: React.ReactNode;
  let badge = "";

  switch (widget.kind) {
    case "kpi": {
      badge = "KPI";
      const period = widget.period ?? "2026-Q1";
      const k = kpis?.find((x) => x.name === widget.kpiName && x.period === period);
      if (!kpis) body = <Loading />;
      else if (!k) body = <NotFound>{widget.kpiName} · {period}</NotFound>;
      else {
        const t = tone(k);
        const delta = k.target != null ? Math.round((k.value - k.target) * 10) / 10 : null;
        body = (
          <div className="p-5">
            <div className="kicker">{k.function} · {k.period}</div>
            <div className="text-[13px] text-[var(--bone-soft)] mt-2">{k.name}</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`hero-num tone-${t}`}>{k.value}</span>
              <span className="font-mono text-[11px] tracking-wider text-[var(--muted)] uppercase">{k.unit}</span>
            </div>
            {k.target != null && (
              <div className="mt-3 font-mono text-[10.5px] tracking-wider text-[var(--muted)]">
                TARGET <span className="text-[var(--bone-soft)] tabular ml-1">{k.target}</span>
                {delta != null && (
                  <span className={`tone-${t} tabular ml-3`}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
      break;
    }

    case "trend": {
      badge = "TREND";
      if (!kpis) body = <Loading />;
      else {
        body = (
          <div className="p-1">
            <TrendChart kpis={kpis} kpiName={widget.kpiName} />
          </div>
        );
      }
      break;
    }

    case "gauge": {
      badge = "GAUGE";
      const period = widget.period ?? "2026-Q1";
      const k = kpis?.find((x) => x.name === widget.kpiName && x.period === period);
      if (!kpis) body = <Loading />;
      else if (!k) body = <NotFound>{widget.kpiName} · {period}</NotFound>;
      else body = <Gauge kpi={k} />;
      break;
    }

    case "sparkline": {
      badge = "SPARKLINE";
      if (!kpis) body = <Loading />;
      else body = <Sparkline kpis={kpis} kpiName={widget.kpiName} />;
      break;
    }

    case "heatmap": {
      badge = "HEATMAP";
      if (!kpis) body = <Loading />;
      else body = <Heatmap kpis={kpis} function_={widget.function_} />;
      break;
    }

    case "compare": {
      badge = "COMPARE";
      if (!kpis) body = <Loading />;
      else body = <Compare kpis={kpis} kpiNames={widget.kpiNames} period={widget.period} />;
      break;
    }

    case "products": {
      badge = "CATALOG";
      const filtered = (products ?? []).filter(
        (p) => !widget.therapyArea || p.therapy_area.toLowerCase() === widget.therapyArea.toLowerCase(),
      );
      body = !products ? <Loading /> : (
        <div className="p-0">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--line)]">
            <div className="kicker">[ {widget.therapyArea ?? "ALL"} · {filtered.length.toString().padStart(2,"0")} ]</div>
            <div className="font-display-stand text-[20px] mt-1">{widget.title ?? "Products"}</div>
          </div>
          <div className="max-h-[280px] overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.name} className="border-t border-[var(--line)]">
                    <td className="px-5 py-2.5 font-display-stand text-[16px]">{p.name}</td>
                    <td className="py-2.5 pr-3 text-[var(--bone-soft)]">{p.indication}</td>
                    <td className="py-2.5 pr-5 text-right font-mono text-[10.5px] tracking-wider uppercase text-[var(--muted-hi)]">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
      break;
    }

    case "trials": {
      badge = "TRIALS";
      const filtered = (trials ?? []).filter((t) =>
        (!widget.productName || t.product.toLowerCase().includes(widget.productName.toLowerCase())) &&
        (!widget.phase || t.phase === widget.phase) &&
        (!widget.status || t.status.toLowerCase() === widget.status.toLowerCase()),
      );
      body = !trials ? <Loading /> : (
        <div className="p-0">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--line)]">
            <div className="kicker">
              [ {widget.productName ? widget.productName.toUpperCase() : "ALL"} ·{" "}
              {filtered.length.toString().padStart(2, "0")} ]
            </div>
            <div className="font-display-stand text-[20px] mt-1">{widget.title ?? "Clinical trials"}</div>
          </div>
          <div className="max-h-[280px] overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.trial_id} className="border-t border-[var(--line)]">
                    <td className="px-5 py-2.5 font-mono text-[11px] text-[var(--muted-hi)]">{t.trial_id}</td>
                    <td className="py-2.5 pr-3 text-[var(--bone)]">{t.product}</td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-[var(--bone-soft)]">PH {t.phase}</td>
                    <td className="py-2.5 pr-5 text-right text-[var(--muted-hi)] font-mono text-[10.5px] uppercase tracking-wider">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
      break;
    }

    case "note": {
      badge = "NOTE";
      body = (
        <div className="p-5">
          <div className="prose-invert text-[14.5px] text-[var(--bone-soft)] leading-relaxed whitespace-pre-wrap">
            {widget.markdown}
          </div>
        </div>
      );
      break;
    }
  }

  return (
    <DraggableWidget id={widget.id}>
      {/* hover toolbar */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        <button
          onClick={() => moveWidget(widget.id, -1)}
          disabled={index === 0}
          title="Move up"
          className="p-1 rounded hover:bg-[var(--surface-hi)] text-[var(--muted-hi)] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={() => moveWidget(widget.id, 1)}
          disabled={index === total - 1}
          title="Move down"
          className="p-1 rounded hover:bg-[var(--surface-hi)] text-[var(--muted-hi)] disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronDown size={13} />
        </button>
        <button
          onClick={() => removeWidget(widget.id)}
          title="Remove"
          className="p-1 rounded hover:bg-[var(--coral)]/15 hover:text-[var(--coral)] text-[var(--muted-hi)]"
        >
          <X size={13} />
        </button>
      </div>

      {/* drag handle */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-[var(--muted-hi)] hover:text-[var(--bone)]"
        title="Drag to reorder"
        data-drag-handle
      >
        <GripVertical size={13} />
      </div>

      {/* badge */}
      {badge && (
        <div className="absolute top-2 left-3 z-10 font-mono text-[9.5px] tracking-[0.2em] uppercase text-[var(--muted)] pointer-events-none">
          {badge}
        </div>
      )}

      {body}
    </DraggableWidget>
  );
}

function DraggableWidget({
  id, children,
}: Readonly<{ id: string; children: React.ReactNode }>) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver]         = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/widget-id", id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragEnter={(e) => {
        const from = e.dataTransfer.types.includes("text/widget-id");
        if (from) setOver(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("text/widget-id")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData("text/widget-id");
        if (fromId) reorderWidgets(fromId, id);
        setOver(false);
      }}
      className={`surface-soft p-0 relative group overflow-hidden reveal ${
        dragging ? "is-dragging" : ""
      } ${over && !dragging ? "drop-target" : ""}`}
    >
      {children}
    </div>
  );
}

function Loading() {
  return <div className="p-6 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--muted)]">loading…</div>;
}

function NotFound({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--coral)]">
      ▲ not found · {children}
    </div>
  );
}

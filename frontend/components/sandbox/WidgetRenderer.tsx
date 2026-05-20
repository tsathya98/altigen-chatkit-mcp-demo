"use client";

import { Settings2, Trash2, X } from "lucide-react";
import {
  removeWidget,
  type Widget,
} from "@/lib/sandbox-store";
import { selectWidget, useSelected } from "@/lib/selection-state";
import type { Kpi, Product, Trial } from "@/lib/api";
import { TrendChart } from "../TrendChart";
import { Compare } from "./widgets/Compare";
import { Gauge } from "./widgets/Gauge";
import { Heatmap } from "./widgets/Heatmap";
import { Sparkline } from "./widgets/Sparkline";

type Filters = { period?: string; therapyArea?: string; function?: string };

type Props = Readonly<{
  widget: Widget;
  products?: Product[];
  trials?: Trial[];
  kpis?: Kpi[];
  filters: Filters;
}>;

function tone(k: Kpi): "positive" | "warning" | "critical" | "neutral" {
  if (k.target == null) return "neutral";
  if (k.value >= k.target) return "positive";
  if (k.value >= k.target * 0.95) return "warning";
  return "critical";
}

export function WidgetRenderer({ widget, products, trials, kpis, filters }: Props) {
  let body: React.ReactNode = null;
  let badge = "";
  const selected = useSelected();
  const isSelected = selected === widget.id;

  // Effective filter values: widget-level wins over global filter.
  const eff = {
    period:      (widget as any).period ?? filters.period ?? "2026-Q1",
    therapyArea: (widget as any).therapyArea ?? filters.therapyArea,
    function_:   (widget as any).function_ ?? filters.function,
  };

  switch (widget.kind) {
    case "kpi": {
      badge = "KPI";
      const k = kpis?.find((x) => x.name === widget.kpiName && x.period === eff.period);
      if (!kpis) body = <Loading />;
      else if (!k) body = <NotFound>{widget.kpiName} · {eff.period}</NotFound>;
      else {
        const t = tone(k);
        const delta = k.target != null ? Math.round((k.value - k.target) * 10) / 10 : null;
        body = (
          <div className="p-5">
            <div className="kicker">{k.function} · {k.period}</div>
            <div className="text-[13px] text-[var(--bone-soft)] mt-2">{widget.title ?? k.name}</div>
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
      else body = <div className="p-1 h-full"><TrendChart kpis={kpis} kpiName={widget.kpiName} variant={widget.variant} /></div>;
      break;
    }

    case "gauge": {
      badge = "GAUGE";
      const k = kpis?.find((x) => x.name === widget.kpiName && x.period === eff.period);
      if (!kpis) body = <Loading />;
      else if (!k) body = <NotFound>{widget.kpiName} · {eff.period}</NotFound>;
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
      else body = <Heatmap kpis={kpis} function_={eff.function_} />;
      break;
    }

    case "compare": {
      badge = "COMPARE";
      if (!kpis) body = <Loading />;
      else body = <Compare kpis={kpis} kpiNames={widget.kpiNames} period={eff.period} />;
      break;
    }

    case "products": {
      badge = "CATALOG";
      const filtered = (products ?? []).filter(
        (p) => !eff.therapyArea || p.therapy_area.toLowerCase() === eff.therapyArea.toLowerCase(),
      );
      body = !products ? <Loading /> : (
        <div className="p-0 h-full flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--line)] shrink-0">
            <div className="kicker">[ {eff.therapyArea ?? "ALL"} · {filtered.length.toString().padStart(2,"0")} ]</div>
            <div className="font-display-stand text-[20px] mt-1">{widget.title ?? "Products"}</div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
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
        <div className="p-0 h-full flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--line)] shrink-0">
            <div className="kicker">
              [ {widget.productName ? widget.productName.toUpperCase() : "ALL"} ·{" "}
              {filtered.length.toString().padStart(2, "0")} ]
            </div>
            <div className="font-display-stand text-[20px] mt-1">{widget.title ?? "Clinical trials"}</div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
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
        <div className="p-5 h-full overflow-auto">
          {widget.title && <div className="kicker mb-1.5">[ {widget.title.toUpperCase()} ]</div>}
          <div className="text-[14.5px] text-[var(--bone-soft)] leading-relaxed whitespace-pre-wrap">
            {widget.markdown}
          </div>
        </div>
      );
      break;
    }
  }

  return (
    <div className="surface-soft relative h-full w-full overflow-hidden">
      {/* badge */}
      {badge && (
        <div className="absolute top-2 left-3 z-10 font-mono text-[9.5px] tracking-[0.2em] uppercase text-[var(--muted)] pointer-events-none">
          {badge}
        </div>
      )}

      {/* toolbar — show when selected; settings opens the properties panel
          (which is wired in SandboxClient via the selection store). */}
      <div
        data-no-drag
        className={`absolute top-2 right-2 z-10 flex items-center gap-0.5 transition-opacity ${
          isSelected ? "opacity-100" : "opacity-0 hover:opacity-100"
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); selectWidget(widget.id); }}
          title="Edit"
          className="p-1 rounded hover:bg-[var(--surface-hi)] text-[var(--muted-hi)]"
        >
          <Settings2 size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
          title="Remove"
          className="p-1 rounded hover:bg-[var(--coral)]/15 hover:text-[var(--coral)] text-[var(--muted-hi)]"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {body}
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

"use client";

import {
  Activity,
  BookOpen,
  Columns3,
  FlaskConical,
  Gauge as GaugeIcon,
  Grid3x3,
  LineChart,
  Plus,
  Sparkles,
  StickyNote,
  TrendingUp,
} from "lucide-react";
import { addWidget } from "@/lib/sandbox-store";

const ITEMS = [
  {
    icon: <GaugeIcon size={13} />, label: "KPI",
    make: () => addWidget({ kind: "kpi", kpiName: "Net product revenue (Zenoxitam)", period: "2026-Q1" }),
  },
  {
    icon: <Activity size={13} />, label: "Gauge",
    make: () => addWidget({ kind: "gauge", kpiName: "Batch right-first-time", period: "2026-Q1" }),
  },
  {
    icon: <Sparkles size={13} />, label: "Sparkline",
    make: () => addWidget({ kind: "sparkline", kpiName: "Net product revenue (Adipara)" }),
  },
  {
    icon: <TrendingUp size={13} />, label: "Trend",
    make: () => addWidget({ kind: "trend", kpiName: "Net product revenue (Zenoxitam)" }),
  },
  {
    icon: <Grid3x3 size={13} />, label: "Heatmap",
    make: () => addWidget({ kind: "heatmap" }),
  },
  {
    icon: <Columns3 size={13} />, label: "Compare",
    make: () => addWidget({
      kind: "compare",
      kpiNames: ["Net product revenue (Zenoxitam)", "Net product revenue (Adipara)"],
      period: "2026-Q1",
    }),
  },
  {
    icon: <BookOpen size={13} />, label: "Products",
    make: () => addWidget({ kind: "products" }),
  },
  {
    icon: <FlaskConical size={13} />, label: "Trials",
    make: () => addWidget({ kind: "trials" }),
  },
  {
    icon: <StickyNote size={13} />, label: "Note",
    make: () => addWidget({ kind: "note", markdown: "Add a headline or context for this dashboard." }),
  },
];

export function NewWidgetMenu() {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--muted)] mr-1">
        <Plus size={11} className="inline mr-1 align-[-1px]" /> Add widget
      </span>
      {ITEMS.map((it) => (
        <button
          key={it.label}
          onClick={() => it.make()}
          className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[var(--line-hi)] rounded-md text-[var(--bone-soft)] hover:text-[var(--bone)] hover:border-[var(--bone-soft)] transition-colors"
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

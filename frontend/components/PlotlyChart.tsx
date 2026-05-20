"use client";

/**
 * Plotly-backed chart renderer for the Studio canvas.
 *
 * Pure presentation: takes a fully-enriched spec (data already inline,
 * pulled out of pharma.db on the server) and renders an interactive
 * Plotly chart — zoom, pan, hover crosshairs, download-as-PNG, legend
 * toggle. Plotly is heavy (~3MB), so the actual library is dynamically
 * imported the first time a chart appears, gated behind <Suspense>.
 *
 * Supported `kind` values: trend, sparkline, kpi, gauge, compare,
 * heatmap. Tabular kinds (products, trials, note) stay outside Plotly.
 */

import dynamic from "next/dynamic";
import type { Layout, Config, Data } from "plotly.js";

// react-plotly bundles plotly.js as well; lazy-load to keep the initial
// bundle small. ssr:false because Plotly touches `document`.
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--muted)]">
        loading chart…
      </span>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Spec types — all data is pre-fetched and embedded by the backend.
// ---------------------------------------------------------------------------

export type TrendSpec = {
  kind: "trend" | "sparkline";
  kpiName?: string;
  title?: string;
  variant?: "area" | "line";
  unit?: string;
  function?: string;
  target?: number | null;
  data?: { period: string; value: number }[];
};

export type KpiSpec = {
  kind: "kpi" | "gauge";
  kpiName?: string;
  title?: string;
  period?: string;
  value?: number;
  target?: number | null;
  unit?: string;
  function?: string;
};

export type CompareSpec = {
  kind: "compare";
  kpiNames?: string[];
  period?: string;
  title?: string;
  data?: { name: string; value: number; target: number | null; unit: string }[];
};

export type HeatmapSpec = {
  kind: "heatmap";
  function_?: string;
  title?: string;
  data?: { name: string; function: string; period: string; value: number; target: number | null; unit: string }[];
};

export type PlotlySpec = TrendSpec | KpiSpec | CompareSpec | HeatmapSpec;

// ---------------------------------------------------------------------------
// Shared Plotly settings
// ---------------------------------------------------------------------------

const PAPER = "rgba(0,0,0,0)";
const MINT  = "#7af3d0";
const BONE  = "#f5f0e8";
const MUTED = "#7a7783";
const LINE  = "rgba(245,240,232,0.10)";

const BASE_LAYOUT: Partial<Layout> = {
  paper_bgcolor: PAPER,
  plot_bgcolor: PAPER,
  font: {
    family: 'var(--font-mono), "Geist Mono", ui-monospace, monospace',
    size: 11,
    color: BONE,
  },
  margin: { l: 56, r: 16, t: 14, b: 40 },
  hoverlabel: {
    bgcolor: "rgba(20,20,22,0.92)",
    bordercolor: LINE,
    font: { family: 'var(--font-mono)', size: 11, color: BONE },
  },
  xaxis: {
    gridcolor: LINE,
    zerolinecolor: LINE,
    tickcolor: MUTED,
    tickfont: { color: MUTED, size: 10 },
  },
  yaxis: {
    gridcolor: LINE,
    zerolinecolor: LINE,
    tickcolor: MUTED,
    tickfont: { color: MUTED, size: 10 },
  },
  showlegend: false,
};

const BASE_CONFIG: Partial<Config> = {
  responsive: true,
  displaylogo: false,
  displayModeBar: "hover",
  // Strip the buttons we don't want; keep zoom/pan/reset + download.
  modeBarButtonsToRemove: [
    "select2d",
    "lasso2d",
    "autoScale2d",
    "hoverClosestCartesian",
    "hoverCompareCartesian",
    "toggleSpikelines",
  ],
  toImageButtonOptions: {
    format: "png",
    height: 720,
    width: 1280,
    scale: 2,
  },
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function PlotlyChart({ spec, minHeight = 360 }: Readonly<{ spec: PlotlySpec; minHeight?: number }>) {
  const built = build(spec);
  if (!built) {
    return (
      <div className="p-6 flex items-center justify-center font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--coral)]">
        ▲ chart spec missing data
      </div>
    );
  }
  const { traces, layout } = built;
  return (
    <div className="w-full" style={{ minHeight }}>
      <Plot
        data={traces}
        layout={{ ...BASE_LAYOUT, ...layout, autosize: true }}
        config={BASE_CONFIG}
        useResizeHandler
        style={{ width: "100%", height: `${minHeight}px` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-kind trace + layout builders
// ---------------------------------------------------------------------------

function build(spec: PlotlySpec): { traces: Data[]; layout: Partial<Layout> } | null {
  switch (spec.kind) {
    case "trend":
    case "sparkline":
      return buildTrend(spec);
    case "gauge":
      return buildGauge(spec);
    case "kpi":
      // KPI cards are rendered outside Plotly (handled by the canvas).
      return null;
    case "compare":
      return buildCompare(spec);
    case "heatmap":
      return buildHeatmap(spec);
  }
}

function buildTrend(spec: TrendSpec): { traces: Data[]; layout: Partial<Layout> } | null {
  const data = spec.data ?? [];
  if (data.length === 0) return null;
  const x = data.map((d) => d.period);
  const y = data.map((d) => d.value);
  const unit = spec.unit ?? "";
  const isArea = spec.variant !== "line";

  const traces: Data[] = [
    {
      type: "scatter",
      mode: "lines+markers",
      x,
      y,
      name: spec.kpiName ?? "value",
      line: { color: MINT, width: 2.2, shape: "spline" },
      marker: { size: 7, color: MINT, line: { color: "rgba(0,0,0,0.4)", width: 1 } },
      ...(isArea
        ? { fill: "tozeroy", fillcolor: "rgba(122,243,208,0.18)" }
        : {}),
      hovertemplate: `<b>%{x}</b><br>%{y:,.1f} ${unit}<extra></extra>`,
    },
  ];

  if (typeof spec.target === "number") {
    traces.push({
      type: "scatter",
      mode: "lines",
      x,
      y: x.map(() => spec.target!),
      name: "target",
      line: { color: MUTED, width: 1, dash: "dash" },
      hovertemplate: `target %{y:,.1f} ${unit}<extra></extra>`,
    });
  }

  return {
    traces,
    layout: {
      yaxis: { ...BASE_LAYOUT.yaxis, title: { text: unit, font: { color: MUTED, size: 10 } } },
    },
  };
}

function buildCompare(spec: CompareSpec): { traces: Data[]; layout: Partial<Layout> } | null {
  const rows = spec.data ?? [];
  if (rows.length === 0) return null;
  const names = rows.map((r) => r.name);
  const values = rows.map((r) => r.value);
  const targets = rows.map((r) => r.target ?? null);
  const unit = rows[0]?.unit ?? "";
  const colors = values.map((v, i) => {
    const t = targets[i];
    if (t == null) return MINT;
    if (v >= t)            return "#7af3d0";
    if (v >= t * 0.95)     return "#f5d976";
    return "#f47b6e";
  });

  const traces: Data[] = [
    {
      type: "bar",
      x: names,
      y: values,
      marker: { color: colors, line: { color: "rgba(0,0,0,0.3)", width: 0 } },
      hovertemplate: `<b>%{x}</b><br>%{y:,.1f} ${unit}<extra></extra>`,
    },
    {
      type: "scatter",
      mode: "markers",
      x: names,
      y: targets,
      name: "target",
      marker: { symbol: "line-ew-open", size: 32, color: MUTED, line: { width: 2 } },
      hovertemplate: `target %{y:,.1f} ${unit}<extra></extra>`,
    },
  ];
  return {
    traces,
    layout: {
      xaxis: { ...BASE_LAYOUT.xaxis, tickangle: -15 },
      yaxis: { ...BASE_LAYOUT.yaxis, title: { text: unit, font: { color: MUTED, size: 10 } } },
      bargap: 0.45,
    },
  };
}

function buildGauge(spec: KpiSpec): { traces: Data[]; layout: Partial<Layout> } | null {
  if (typeof spec.value !== "number") return null;
  const target = spec.target ?? null;
  const max = target != null ? Math.max(spec.value, target) * 1.2 : spec.value * 1.2;
  const tone =
    target == null ? MINT :
    spec.value >= target ? "#7af3d0" :
    spec.value >= target * 0.95 ? "#f5d976" :
    "#f47b6e";

  const traces: Data[] = [
    {
      type: "indicator" as unknown as Data["type"],
      mode: "gauge+number+delta",
      value: spec.value,
      number: { suffix: spec.unit ? ` ${spec.unit}` : undefined, font: { color: BONE, size: 36 } },
      delta: target != null
        ? { reference: target, increasing: { color: "#7af3d0" }, decreasing: { color: "#f47b6e" } }
        : undefined,
      gauge: {
        axis: { range: [0, max], tickcolor: MUTED, tickfont: { color: MUTED, size: 10 } },
        bar: { color: tone, thickness: 0.28 },
        bgcolor: "rgba(245,240,232,0.04)",
        bordercolor: LINE,
        threshold: target != null
          ? { line: { color: MUTED, width: 2 }, thickness: 0.85, value: target }
          : undefined,
      },
      title: spec.kpiName ? { text: spec.kpiName, font: { color: BONE, size: 13 } } : undefined,
    } as unknown as Data,
  ];

  return {
    traces,
    layout: {
      margin: { l: 24, r: 24, t: 40, b: 24 },
    },
  };
}

function buildHeatmap(spec: HeatmapSpec): { traces: Data[]; layout: Partial<Layout> } | null {
  const rows = spec.data ?? [];
  if (rows.length === 0) return null;

  // Build matrix: rows = KPI names, cols = periods, cell = value/target ratio.
  const names = Array.from(new Set(rows.map((r) => r.name)));
  const periods = Array.from(new Set(rows.map((r) => r.period))).sort();
  const z: (number | null)[][] = names.map((n) =>
    periods.map((p) => {
      const r = rows.find((x) => x.name === n && x.period === p);
      if (!r || r.target == null) return null;
      return r.value / r.target;
    }),
  );

  return {
    traces: [
      {
        type: "heatmap",
        x: periods,
        y: names,
        z,
        colorscale: [
          [0.0, "#f47b6e"],
          [0.5, "#f5d976"],
          [0.75, "#a8e0b8"],
          [1.0, "#7af3d0"],
        ],
        zmin: 0.6,
        zmax: 1.1,
        showscale: false,
        hovertemplate: "<b>%{y}</b><br>%{x} · %{z:.2f}× of target<extra></extra>",
      } as Data,
    ],
    layout: {
      margin: { l: 200, r: 20, t: 16, b: 40 },
      xaxis: { ...BASE_LAYOUT.xaxis, side: "bottom" },
      yaxis: { ...BASE_LAYOUT.yaxis, automargin: true },
    },
  };
}

"use client";

/**
 * Inline sparkline + headline. Compact KPI card showing the current value,
 * delta vs first period, and a tiny SVG sparkline of the full series.
 */

import type { Kpi } from "@/lib/api";

type Props = Readonly<{
  kpis: Kpi[];      // all kpis (we filter inside)
  kpiName: string;
}>;

export function Sparkline({ kpis, kpiName }: Props) {
  const series = kpis
    .filter((k) => k.name === kpiName)
    .sort((a, b) => a.period.localeCompare(b.period));

  if (!series.length) {
    return (
      <div className="p-5 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--coral)]">
        ▲ no data · {kpiName}
      </div>
    );
  }

  const latest = series[series.length - 1];
  const first  = series[0];
  const min = Math.min(...series.map((s) => s.value));
  const max = Math.max(...series.map((s) => s.value));
  const range = Math.max(1e-9, max - min);

  const W = 220;
  const H = 56;
  const path = series
    .map((p, i) => {
      const x = (i / Math.max(1, series.length - 1)) * W;
      const y = H - ((p.value - min) / range) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  // Closed area for fill.
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;

  const delta = first.value
    ? Math.round(((latest.value - first.value) / first.value) * 1000) / 10
    : null;

  const tone =
    latest.target == null ? "neutral" :
    latest.value >= latest.target ? "positive" :
    latest.value >= latest.target * 0.95 ? "warning" : "critical";

  const color =
    tone === "positive" ? "var(--mint)" :
    tone === "warning"  ? "var(--amber)" :
    tone === "critical" ? "var(--coral)" : "var(--bone-soft)";

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="kicker">{latest.function} · {series.length} pts</div>
          <div className="text-[13px] text-[var(--bone-soft)] mt-1 truncate" title={latest.name}>
            {latest.name}
          </div>
        </div>
        {delta != null && (
          <span className={`font-mono text-[11px] tabular tracking-wider uppercase tone-${delta >= 0 ? "positive" : "critical"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`hero-num tone-${tone}`}>{latest.value}</span>
        <span className="font-mono text-[11px] tracking-wider text-[var(--muted)] uppercase">{latest.unit}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-${kpiName}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#spark-${kpiName})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
        <circle
          cx={W}
          cy={H - ((latest.value - min) / range) * H}
          r="2.5"
          fill={color}
        />
      </svg>

      {latest.target != null && (
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-wider text-[var(--muted)]">
          <span>{first.period}</span>
          <span>TARGET <span className="text-[var(--bone-soft)] tabular ml-1">{latest.target}</span></span>
          <span>{latest.period}</span>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Half-circle gauge for a single KPI value vs target. Renders an SVG arc
 * that fills from 0 to (value / max), with the target marked by a tick.
 *
 * Pure SVG — no chart-lib dep. The arc length is computed from the path's
 * SVG-defined length (240 units) so the dash-offset animation in globals.css
 * lines up.
 */

import type { Kpi } from "@/lib/api";

type Props = Readonly<{
  kpi: Kpi;
  max?: number;
}>;

export function Gauge({ kpi, max }: Props) {
  const effectiveMax = max ?? Math.max(kpi.target ?? 0, kpi.value) * 1.15;
  const pct = clamp01(kpi.value / effectiveMax);
  const targetPct = kpi.target ? clamp01(kpi.target / effectiveMax) : null;

  const tone =
    kpi.target == null ? "neutral" :
    kpi.value >= kpi.target ? "positive" :
    kpi.value >= kpi.target * 0.95 ? "warning" : "critical";

  const color =
    tone === "positive" ? "var(--mint)" :
    tone === "warning"  ? "var(--amber)" :
    tone === "critical" ? "var(--coral)" : "var(--bone-soft)";

  // Path: half-circle from 180° to 0°, radius 100, centered at (110, 110).
  // SVG arc total length ≈ π * 100 ≈ 314 — we set stroke-dasharray to 314
  // and animate dash-offset from (1-pct)*314 to give a sweep.
  const ARC_LEN = Math.PI * 100;
  const dashOffset = (1 - pct) * ARC_LEN;
  const targetX = targetPct != null ? 110 - 100 * Math.cos(Math.PI * targetPct) : null;
  const targetY = targetPct != null ? 110 - 100 * Math.sin(Math.PI * targetPct) : null;

  return (
    <div className="p-5 flex flex-col items-center">
      <div className="kicker text-center">{kpi.function} · {kpi.period}</div>
      <div className="text-[13px] text-[var(--bone-soft)] mt-1.5 text-center max-w-[280px]">
        {kpi.name}
      </div>

      <svg viewBox="0 0 220 130" className="w-full max-w-[280px] mt-4">
        <defs>
          <linearGradient id={`g-${kpi.name}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* track */}
        <path
          d="M 10 110 A 100 100 0 0 1 210 110"
          fill="none"
          stroke="var(--line-hi)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* progress */}
        <path
          d="M 10 110 A 100 100 0 0 1 210 110"
          fill="none"
          stroke={`url(#g-${kpi.name})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${ARC_LEN} ${ARC_LEN}`}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.16,1,.3,1)" }}
        />

        {/* target tick */}
        {targetX != null && targetY != null && (
          <line
            x1={targetX}
            y1={targetY - 6}
            x2={targetX}
            y2={targetY + 6}
            stroke="var(--bone)"
            strokeWidth="2"
            opacity="0.7"
          />
        )}
      </svg>

      <div className="mt-1 flex items-baseline gap-2">
        <span className={`hero-num tone-${tone}`}>{kpi.value}</span>
        <span className="font-mono text-[11px] tracking-wider text-[var(--muted)] uppercase">
          {kpi.unit}
        </span>
      </div>

      {kpi.target != null && (
        <div className="mt-2 font-mono text-[10.5px] tracking-wider text-[var(--muted)]">
          TARGET <span className="text-[var(--bone-soft)] tabular ml-1">{kpi.target} {kpi.unit}</span>
        </div>
      )}
    </div>
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

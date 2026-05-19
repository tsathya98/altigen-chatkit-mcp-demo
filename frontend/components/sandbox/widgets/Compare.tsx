"use client";

/**
 * Multi-KPI comparison strip. Renders 2-4 KPIs side-by-side with bars
 * sized by `value / max(target, max(values))` so they're visually aligned.
 */

import type { Kpi } from "@/lib/api";

type Props = Readonly<{
  kpis: Kpi[];
  kpiNames: string[];
  period?: string;
}>;

function tone(k: Kpi) {
  if (k.target == null) return "neutral" as const;
  if (k.value >= k.target) return "positive" as const;
  if (k.value >= k.target * 0.95) return "warning" as const;
  return "critical" as const;
}

const COLOR: Record<string, string> = {
  positive: "var(--mint)",
  warning:  "var(--amber)",
  critical: "var(--coral)",
  neutral:  "var(--bone-soft)",
};

export function Compare({ kpis, kpiNames, period = "2026-Q1" }: Props) {
  const items = kpiNames
    .map((name) => kpis.find((k) => k.name === name && k.period === period))
    .filter(Boolean) as Kpi[];

  if (!items.length) {
    return (
      <div className="p-5 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--coral)]">
        ▲ none of those KPIs match · {period}
      </div>
    );
  }

  const max = Math.max(...items.map((k) => Math.max(k.value, k.target ?? 0))) * 1.1;

  return (
    <div className="p-0">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--line)]">
        <div className="kicker">[ COMPARE · {period} ]</div>
        <div className="font-display-stand text-[20px] mt-1">Side-by-side</div>
      </div>

      <ul className="p-3 space-y-3">
        {items.map((k) => {
          const t = tone(k);
          const pct = Math.max(0, Math.min(100, (k.value / max) * 100));
          const targetPct = k.target ? (k.target / max) * 100 : null;
          return (
            <li key={k.name}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[12.5px] text-[var(--bone-soft)] truncate" title={k.name}>{k.name}</span>
                <span className={`font-mono tabular text-[12px] tone-${t}`}>
                  {k.value} <span className="text-[var(--muted)] text-[10px]">{k.unit}</span>
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-[var(--surface-hi)]/60 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: COLOR[t],
                    transition: "width 800ms cubic-bezier(.16,1,.3,1)",
                  }}
                />
                {targetPct != null && (
                  <div
                    className="absolute inset-y-[-2px] w-[1px] bg-[var(--bone)]/60"
                    style={{ left: `${targetPct}%` }}
                    title={`Target ${k.target} ${k.unit}`}
                  />
                )}
              </div>
              {k.target != null && (
                <div className="mt-1 font-mono text-[9.5px] tracking-wider text-[var(--muted)] uppercase">
                  Target {k.target} {k.unit}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

/**
 * KPI Heatmap — function × period grid, cells coloured by tone (positive /
 * warning / critical). One swoopy view of the entire operations posture.
 */

import type { Kpi } from "@/lib/api";

type Props = Readonly<{
  kpis: Kpi[];
  function_?: string;  // optional filter to a single function
}>;

function tone(k: Kpi): "positive" | "warning" | "critical" | "neutral" {
  if (k.target == null) return "neutral";
  if (k.value >= k.target) return "positive";
  if (k.value >= k.target * 0.95) return "warning";
  return "critical";
}

const TONE_BG: Record<string, string> = {
  positive: "rgba(122,243,208,0.22)",
  warning:  "rgba(245,181,74,0.20)",
  critical: "rgba(255,122,92,0.22)",
  neutral:  "rgba(245,240,232,0.04)",
};

const TONE_BORDER: Record<string, string> = {
  positive: "rgba(122,243,208,0.55)",
  warning:  "rgba(245,181,74,0.55)",
  critical: "rgba(255,122,92,0.55)",
  neutral:  "rgba(245,240,232,0.08)",
};

export function Heatmap({ kpis, function_ }: Props) {
  const filtered = function_ ? kpis.filter((k) => k.function === function_) : kpis;
  const periods = Array.from(new Set(filtered.map((k) => k.period))).sort();
  const names   = Array.from(new Set(filtered.map((k) => k.name))).sort();

  if (!names.length) {
    return (
      <div className="p-5 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--coral)]">
        ▲ no KPI data
      </div>
    );
  }

  const byKey: Record<string, Kpi> = {};
  for (const k of filtered) byKey[`${k.name}|${k.period}`] = k;

  return (
    <div className="p-0">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--line)]">
        <div className="kicker">[ HEATMAP · {function_ ? function_.toUpperCase() : "ALL FUNCTIONS"} ]</div>
        <div className="font-display-stand text-[20px] mt-1">Health across periods</div>
      </div>

      <div className="p-3 overflow-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {periods.map((p) => (
                <th key={p} className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase font-normal pb-1">
                  {p.split("-")[1] ?? p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((name) => (
              <tr key={name}>
                <td className="pr-2 text-right text-[11.5px] text-[var(--bone-soft)] max-w-[180px] truncate">
                  {name}
                </td>
                {periods.map((p) => {
                  const k = byKey[`${name}|${p}`];
                  if (!k) {
                    return (
                      <td key={p} className="p-0">
                        <div className="h-8 rounded-sm bg-[var(--surface-hi)]/30" />
                      </td>
                    );
                  }
                  const t = tone(k);
                  const delta = k.target ? Math.round((k.value - k.target) * 10) / 10 : null;
                  return (
                    <td key={p} className="p-0">
                      <div
                        title={`${k.name} · ${p} · ${k.value}${k.unit} (target ${k.target ?? "—"})`}
                        className="h-8 rounded-sm border flex items-center justify-center font-mono text-[10px] tabular text-[var(--bone)]"
                        style={{
                          background: TONE_BG[t],
                          borderColor: TONE_BORDER[t],
                        }}
                      >
                        {delta != null ? (delta > 0 ? `+${delta}` : delta) : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* legend */}
        <div className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
          {(["positive", "warning", "critical"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm border"
                style={{ background: TONE_BG[t], borderColor: TONE_BORDER[t] }}
              />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

import type { Kpi } from "@/lib/api";

function tone(k: Kpi): "positive" | "warning" | "critical" | "neutral" {
  if (k.target == null) return "neutral";
  if (k.value >= k.target) return "positive";
  if (k.value >= k.target * 0.95) return "warning";
  return "critical";
}

const FUNCTION_CODE: Record<string, string> = {
  "Clinical Operations": "CLN",
  "Manufacturing":       "MFG",
  "Pharmacovigilance":   "PVG",
  "Commercial":          "COM",
  "R&D":                 "RND",
};

export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  const featured = kpis.slice(0, 4);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {featured.map((k, i) => {
        const t = tone(k);
        const code = FUNCTION_CODE[k.function] ?? "—";
        const delta =
          k.target != null ? Math.round((k.value - k.target) * 10) / 10 : null;
        return (
          <div
            key={`${k.name}-${k.period}`}
            className="surface-soft p-5 reveal scanlines"
            style={{ animationDelay: `${120 + i * 70}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] tracking-[0.2em] text-[var(--muted-hi)]">
                {code} · {k.period}
              </span>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    t === "positive" ? "var(--mint)" :
                    t === "warning"  ? "var(--amber)" :
                    t === "critical" ? "var(--coral)" : "var(--muted)",
                  boxShadow:
                    t === "positive" ? "0 0 10px var(--mint)" :
                    t === "warning"  ? "0 0 10px var(--amber)" :
                    t === "critical" ? "0 0 10px var(--coral)" : "none",
                }}
              />
            </div>

            <div className="mt-2 text-[13px] text-[var(--bone-soft)] leading-snug">
              {k.name}
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className={`hero-num tone-${t}`}>{k.value}</span>
              <span className="font-mono text-[11px] tracking-wider text-[var(--muted)] uppercase">
                {k.unit}
              </span>
            </div>

            {k.target != null && (
              <div className="mt-3 flex items-center justify-between font-mono text-[10.5px] tracking-wider text-[var(--muted)]">
                <span>TARGET <span className="text-[var(--bone-soft)] tabular ml-1">{k.target}</span></span>
                {delta != null && (
                  <span className={`tone-${t} tabular`}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

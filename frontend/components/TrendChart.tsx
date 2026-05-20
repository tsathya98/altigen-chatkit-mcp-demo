"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Kpi } from "@/lib/api";

export type TrendVariant = "area" | "line";

type Props = {
  kpis: Kpi[];
  kpiName: string;
  options?: string[];
  onKpiChange?: (name: string) => void;
  variant?: TrendVariant;
};

export function TrendChart({ kpis, kpiName, options, onKpiChange, variant = "area" }: Props) {
  const data = kpis
    .filter((k) => k.name === kpiName)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((k) => ({ period: k.period, value: k.value, target: k.target ?? null }));
  if (!data.length) return null;
  const unit = kpis.find((k) => k.name === kpiName)?.unit ?? "";
  const last = data[data.length - 1];
  const first = data[0];
  const delta =
    first?.value != null && last?.value != null
      ? Math.round(((last.value - first.value) / first.value) * 1000) / 10
      : null;

  return (
    <div className="surface-soft p-5 h-[320px] reveal" style={{ animationDelay: "260ms" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="kicker">[ Trend · {data.length} pts ]</div>
          <div className="font-display-stand text-[22px] mt-1">{kpiName}</div>
        </div>
        <div className="flex items-center gap-3">
          {delta != null && (
            <span
              className={`font-mono text-[11px] tabular tracking-wider uppercase ${
                delta >= 0 ? "tone-positive" : "tone-critical"
              }`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
            </span>
          )}
          {options && onKpiChange && (
            <select
              value={kpiName}
              onChange={(e) => onKpiChange(e.target.value)}
              className="bg-transparent border border-[var(--line-hi)] rounded-md px-2.5 py-1.5 text-xs text-[var(--bone-soft)] hover:border-[var(--bone-soft)] cursor-pointer"
            >
              {options.map((n) => (
                <option key={n} value={n} className="bg-[var(--ink-soft)]">{n}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height="78%">
        {variant === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(245,240,232,0.06)" />
            <XAxis
              dataKey="period"
              stroke="#7a7783"
              fontSize={10.5}
              tickLine={false}
              axisLine={{ stroke: "rgba(245,240,232,0.08)" }}
              tickMargin={8}
            />
            <YAxis
              stroke="#7a7783"
              fontSize={10.5}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
            />
            <Tooltip
              contentStyle={{
                background: "var(--ink-soft)",
                border: "1px solid var(--line-hi)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              labelStyle={{ color: "var(--muted-hi)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}
              formatter={(v: number) => [`${v} ${unit}`, ""]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#7af3d0"
              strokeWidth={1.8}
              dot={{ r: 3, fill: "#7af3d0", stroke: "var(--ink)", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#7af3d0", stroke: "var(--ink)", strokeWidth: 2 }}
            />
            {data.some((d) => d.target != null) && (
              <Line
                type="monotone"
                dataKey="target"
                stroke="#7a7783"
                strokeDasharray="3 4"
                strokeWidth={1}
                dot={false}
              />
            )}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#7af3d0" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7af3d0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(245,240,232,0.06)" />
            <XAxis
              dataKey="period"
              stroke="#7a7783"
              fontSize={10.5}
              tickLine={false}
              axisLine={{ stroke: "rgba(245,240,232,0.08)" }}
              tickMargin={8}
            />
            <YAxis
              stroke="#7a7783"
              fontSize={10.5}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
            />
            <Tooltip
              contentStyle={{
                background: "var(--ink-soft)",
                border: "1px solid var(--line-hi)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              labelStyle={{ color: "var(--muted-hi)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}
              formatter={(v: number) => [`${v} ${unit}`, ""]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#7af3d0"
              strokeWidth={1.6}
              fill="url(#trendFill)"
              dot={{ r: 3, fill: "#7af3d0", stroke: "var(--ink)", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#7af3d0", stroke: "var(--ink)", strokeWidth: 2 }}
            />
            {data.some((d) => d.target != null) && (
              <Area
                type="monotone"
                dataKey="target"
                stroke="#7a7783"
                strokeDasharray="3 4"
                strokeWidth={1}
                fill="transparent"
                dot={false}
              />
            )}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

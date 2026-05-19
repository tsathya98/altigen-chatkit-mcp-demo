"use client";

/**
 * Global filter slicers, sitting above the canvas. Period / therapy area /
 * function. Widgets that have their own value for a field win; widgets
 * that leave it blank inherit from here.
 */

import { Filter, X } from "lucide-react";
import { clearFilters, setFilters, useSandbox } from "@/lib/sandbox-store";
import type { Kpi, Product } from "@/lib/api";

type Props = Readonly<{
  kpis?: Kpi[];
  products?: Product[];
}>;

const FUNCTIONS = [
  "Clinical Operations",
  "Manufacturing",
  "Pharmacovigilance",
  "Commercial",
  "R&D",
];

export function FiltersBar({ kpis, products }: Props) {
  const dash = useSandbox();
  const f = dash.filters;

  const periods = Array.from(new Set((kpis ?? []).map((k) => k.period))).sort();
  const areas = Array.from(new Set((products ?? []).map((p) => p.therapy_area))).sort();
  const fns = Array.from(
    new Set([...FUNCTIONS, ...((kpis ?? []).map((k) => k.function))]),
  );

  const hasAny = !!(f.period || f.therapyArea || f.function);

  return (
    <div className="surface-soft px-3 py-2 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-[var(--muted-hi)] px-1">
        <Filter size={12} />
        <span className="kicker">[ Filters ]</span>
      </div>

      <Slicer
        label="Period"
        value={f.period ?? ""}
        options={periods}
        onChange={(v) => setFilters({ period: v || undefined })}
      />
      <Slicer
        label="Therapy area"
        value={f.therapyArea ?? ""}
        options={areas}
        onChange={(v) => setFilters({ therapyArea: v || undefined })}
      />
      <Slicer
        label="Function"
        value={f.function ?? ""}
        options={fns}
        onChange={(v) => setFilters({ function: v || undefined })}
      />

      <div className="flex-1" />

      {hasAny && (
        <button
          onClick={() => clearFilters()}
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--muted-hi)] hover:text-[var(--coral)] px-2 py-1 rounded-md hover:bg-[var(--surface-hi)]/40 transition-colors"
        >
          <X size={11} />
          Clear filters
        </button>
      )}
    </div>
  );
}

function Slicer({
  label, value, options, onChange,
}: Readonly<{
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}>) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-[var(--bone-soft)]">
      <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border border-[var(--line-hi)] rounded-md px-2 py-1 text-[11.5px] text-[var(--bone)] hover:border-[var(--bone-soft)] focus:border-[var(--mint)] outline-none cursor-pointer"
      >
        <option value="" className="bg-[var(--ink-soft)]">all</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[var(--ink-soft)]">{o}</option>
        ))}
      </select>
    </label>
  );
}

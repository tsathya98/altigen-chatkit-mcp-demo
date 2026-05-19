"use client";

/**
 * Right rail with per-kind form controls bound to the selected widget.
 * Closes when nothing is selected. Read-write — every change calls
 * updateWidget(), which persists to localStorage and re-renders the
 * canvas.
 */

import { X } from "lucide-react";
import {
  removeWidget,
  updateWidget,
  useSandbox,
  type Widget,
} from "@/lib/sandbox-store";
import { selectWidget, useSelected } from "@/lib/selection-state";
import type { Kpi, Product } from "@/lib/api";

type Props = Readonly<{
  kpis?: Kpi[];
  products?: Product[];
}>;

export function PropertiesPanel({ kpis, products }: Props) {
  const dash = useSandbox();
  const selectedId = useSelected();
  const w = dash.widgets.find((x) => x.id === selectedId);

  if (!w) return null;

  return (
    <aside className="hidden xl:flex flex-col w-[320px] shrink-0 border-l border-[var(--line)] sticky top-0 self-start"
      style={{ height: "calc(100vh - 0px)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] shrink-0">
        <div className="min-w-0">
          <div className="kicker">[ Properties · {w.kind.toUpperCase()} ]</div>
          <div className="font-display-stand text-[18px] truncate" title={w.id}>
            {w.title ?? humanKind(w.kind)}
          </div>
        </div>
        <button
          onClick={() => selectWidget(null)}
          className="p-1.5 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)]"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <Field label="Title" hint="Falls back to the data's name">
          <input
            value={w.title ?? ""}
            onChange={(e) => updateWidget(w.id, { title: e.target.value || undefined } as Partial<Widget>)}
            placeholder={humanKind(w.kind)}
            className="ctl"
          />
        </Field>

        <KindFields widget={w} kpis={kpis} products={products} />

        <Field label="Position" hint="Drag on the canvas, or set here">
          <div className="grid grid-cols-4 gap-1.5">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <NumberInput
                key={k}
                label={k}
                value={w.pos[k]}
                onChange={(v) =>
                  updateWidget(w.id, { pos: { ...w.pos, [k]: v } } as Partial<Widget>)
                }
              />
            ))}
          </div>
        </Field>
      </div>

      <div className="px-4 py-3 border-t border-[var(--line)] shrink-0">
        <button
          onClick={() => { if (confirm("Remove this widget?")) { removeWidget(w.id); selectWidget(null); } }}
          className="w-full flex items-center justify-center gap-2 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--coral)] border border-[var(--coral)]/40 hover:bg-[var(--coral)]/10 rounded-md py-2 transition-colors"
        >
          Delete widget
        </button>
      </div>

      <style>{`
        .ctl {
          width: 100%;
          background: transparent;
          border: 1px solid var(--line-hi);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12.5px;
          color: var(--bone);
          outline: none;
          transition: border-color 160ms ease;
        }
        .ctl:focus { border-color: var(--mint); }
        .ctl-num { text-align: center; font-family: var(--font-mono); }
      `}</style>
    </aside>
  );
}

// ---------------------------------------------------------------------------

function Field({
  label, hint, children,
}: Readonly<{ label: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)]">
          {label}
        </label>
        {hint && (
          <span className="font-mono text-[9.5px] text-[var(--muted)] italic">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function NumberInput({
  label, value, onChange,
}: Readonly<{ label: string; value: number; onChange: (v: number) => void }>) {
  return (
    <div>
      <div className="text-[9.5px] font-mono text-[var(--muted)] uppercase text-center">{label}</div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="ctl ctl-num"
      />
    </div>
  );
}

function KindFields({
  widget, kpis, products,
}: Readonly<{ widget: Widget; kpis?: Kpi[]; products?: Product[] }>) {
  const kpiNames = Array.from(new Set((kpis ?? []).map((k) => k.name))).sort();
  const periods = Array.from(new Set((kpis ?? []).map((k) => k.period))).sort();
  const areas   = Array.from(new Set((products ?? []).map((p) => p.therapy_area))).sort();
  const fns     = Array.from(new Set((kpis ?? []).map((k) => k.function))).sort();

  switch (widget.kind) {
    case "kpi":
    case "gauge":
      return (
        <>
          <Field label="KPI">
            <Select value={widget.kpiName} options={kpiNames} onChange={(v) => updateWidget(widget.id, { kpiName: v } as any)} />
          </Field>
          <Field label="Period" hint="Blank = use global filter">
            <Select value={widget.period ?? ""} options={periods} onChange={(v) => updateWidget(widget.id, { period: v || undefined } as any)} allowEmpty />
          </Field>
        </>
      );
    case "sparkline":
    case "trend":
      return (
        <Field label="KPI">
          <Select value={widget.kpiName} options={kpiNames} onChange={(v) => updateWidget(widget.id, { kpiName: v } as any)} />
        </Field>
      );
    case "compare":
      return (
        <>
          <Field label="KPIs (2-4)">
            <textarea
              value={widget.kpiNames.join("\n")}
              onChange={(e) => updateWidget(widget.id, { kpiNames: e.target.value.split(/\n/).map((s) => s.trim()).filter(Boolean) } as any)}
              placeholder="One KPI per line"
              rows={4}
              className="ctl"
            />
          </Field>
          <Field label="Period" hint="Blank = use global filter">
            <Select value={widget.period ?? ""} options={periods} onChange={(v) => updateWidget(widget.id, { period: v || undefined } as any)} allowEmpty />
          </Field>
        </>
      );
    case "heatmap":
      return (
        <Field label="Function" hint="Blank = all functions">
          <Select value={widget.function_ ?? ""} options={fns} onChange={(v) => updateWidget(widget.id, { function_: v || undefined } as any)} allowEmpty />
        </Field>
      );
    case "products":
      return (
        <Field label="Therapy area" hint="Blank = all areas">
          <Select value={widget.therapyArea ?? ""} options={areas} onChange={(v) => updateWidget(widget.id, { therapyArea: v || undefined } as any)} allowEmpty />
        </Field>
      );
    case "trials":
      return (
        <>
          <Field label="Product">
            <input value={widget.productName ?? ""} onChange={(e) => updateWidget(widget.id, { productName: e.target.value || undefined } as any)} className="ctl" />
          </Field>
          <Field label="Phase">
            <Select value={widget.phase ?? ""} options={["I","II","III","IV"]} onChange={(v) => updateWidget(widget.id, { phase: v || undefined } as any)} allowEmpty />
          </Field>
          <Field label="Status">
            <Select value={widget.status ?? ""} options={["Recruiting","Active","Completed"]} onChange={(v) => updateWidget(widget.id, { status: v || undefined } as any)} allowEmpty />
          </Field>
        </>
      );
    case "note":
      return (
        <Field label="Markdown">
          <textarea
            value={widget.markdown}
            onChange={(e) => updateWidget(widget.id, { markdown: e.target.value } as any)}
            rows={6}
            className="ctl"
          />
        </Field>
      );
  }
  return null;
}

function Select({
  value, options, onChange, allowEmpty,
}: Readonly<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="ctl cursor-pointer"
    >
      {allowEmpty && <option value="" className="bg-[var(--ink-soft)]">(global)</option>}
      {options.map((o) => (
        <option key={o} value={o} className="bg-[var(--ink-soft)]">{o}</option>
      ))}
    </select>
  );
}

function humanKind(k: string): string {
  return k.charAt(0).toUpperCase() + k.slice(1);
}

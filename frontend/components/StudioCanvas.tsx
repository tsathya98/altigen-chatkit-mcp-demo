"use client";

/**
 * Studio canvas — backend-driven, Plotly-rendered.
 *
 * The agent ships markdown content via `update_canvas`. The Python tool
 * scans every ```altigen-chart``` fence and inlines the actual data
 * series (pulled from pharma.db) before it ever leaves the server, so
 * each fence the frontend sees already carries its own dataset. This
 * file just parses the fences and hands them to <PlotlyChart>, which
 * gives genuine Plotly interactivity (zoom, pan, hover crosshairs,
 * download-PNG, legend toggle).
 *
 * For kinds that aren't chart-shaped — note / products / trials / kpi
 * card — we still render bespoke React components (Plotly's tables and
 * indicators don't look right with our visual language).
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR from "swr";
import { fetchKpis, fetchProducts, fetchTrials, type Kpi, type Product, type Trial } from "@/lib/api";
import { PlotlyChart, type PlotlySpec } from "./PlotlyChart";

const REFRESH_MS = 8_000;
const CHART_LANG = "altigen-chart";

type Props = Readonly<{ title: string | null; content: string }>;

export function StudioCanvas({ title, content }: Props) {
  // Fallback data fetches — only consulted if the backend forgot to inline
  // data on a fence. The happy path uses purely backend-shipped data.
  const kpis     = useSWR<Kpi[]>("kpis", () => fetchKpis(), { refreshInterval: REFRESH_MS });
  const products = useSWR<Product[]>("products", fetchProducts, { refreshInterval: REFRESH_MS });
  const trials   = useSWR<Trial[]>("trials", fetchTrials, { refreshInterval: REFRESH_MS });
  const fallback: FallbackCtx = { kpis: kpis.data, products: products.data, trials: trials.data };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--ink-soft)]">
      <Header title={title} />
      <div className="flex-1 min-h-0 overflow-auto">
        <article className="max-w-[860px] mx-auto px-8 py-8 canvas-prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children }) {
                const langMatch = /language-([\w-]+)/.exec(className ?? "");
                const lang = langMatch?.[1];
                const text = String(children ?? "").trim();
                if (lang === CHART_LANG) {
                  return <ChartFence body={text} fallback={fallback} />;
                }
                if (className) {
                  return (
                    <pre className="bg-[var(--surface-hi)]/40 border border-[var(--line)] rounded-md px-4 py-3 my-3 overflow-x-auto">
                      <code className={className}>{children}</code>
                    </pre>
                  );
                }
                return <code className="px-1.5 py-0.5 rounded bg-[var(--surface-hi)]/40 text-[var(--mint)] font-mono text-[12.5px]">{children}</code>;
              },
              h1: (p) => <h1 className="font-display text-[36px] tracking-[-0.03em] text-[var(--bone)] mt-2 mb-4">{p.children}</h1>,
              h2: (p) => <h2 className="font-display-stand text-[22px] text-[var(--bone)] mt-7 mb-2.5">{p.children}</h2>,
              h3: (p) => <h3 className="font-display-stand text-[17px] text-[var(--bone)] mt-5 mb-1.5">{p.children}</h3>,
              p:  (p) => <p className="text-[15px] leading-[1.7] text-[var(--bone-soft)] my-3">{p.children}</p>,
              li: (p) => <li className="text-[15px] leading-[1.7] text-[var(--bone-soft)] my-1">{p.children}</li>,
              ul: (p) => <ul className="list-disc pl-5 my-3">{p.children}</ul>,
              ol: (p) => <ol className="list-decimal pl-5 my-3">{p.children}</ol>,
              blockquote: (p) => (
                <blockquote className="border-l-2 border-[var(--mint)] pl-4 my-4 text-[var(--muted-hi)] italic">
                  {p.children}
                </blockquote>
              ),
              strong: (p) => <strong className="text-[var(--bone)] font-semibold">{p.children}</strong>,
              em: (p) => <em className="text-[var(--bone)]">{p.children}</em>,
              a: (p) => <a className="text-[var(--mint)] underline underline-offset-2 hover:text-[var(--bone)]" href={p.href}>{p.children}</a>,
              hr: () => <hr className="my-6 border-[var(--line-hi)]" />,
              table: (p) => (
                <div className="my-4 overflow-x-auto">
                  <table className="w-full text-[14px] border border-[var(--line)] rounded-md">{p.children}</table>
                </div>
              ),
              th: (p) => <th className="text-left px-3 py-2 border-b border-[var(--line)] font-mono text-[10.5px] tracking-wider uppercase text-[var(--muted-hi)]">{p.children}</th>,
              td: (p) => <td className="px-3 py-2 border-t border-[var(--line)] text-[var(--bone-soft)]">{p.children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}

function Header({ title }: Readonly<{ title: string | null }>) {
  return (
    <div className="px-6 py-3.5 border-b border-[var(--line)] bg-[var(--surface)]/60 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--mint)]">
          [ CANVAS ]
        </span>
        {title && (
          <>
            <span className="h-3.5 w-px bg-[var(--line-hi)]" />
            <span className="font-display-stand text-[15px] text-[var(--bone)] truncate">
              {title}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fence renderer
// ---------------------------------------------------------------------------

type FallbackCtx = { kpis?: Kpi[]; products?: Product[]; trials?: Trial[] };

type AnySpec = {
  kind: string;
  title?: string;
  // free-form: backend may inline any of these per kind
  data?: unknown;
  kpiName?: string;
  kpiNames?: string[];
  period?: string;
  function_?: string;
  therapyArea?: string;
  productName?: string;
  phase?: string;
  status?: string;
  variant?: "area" | "line";
  unit?: string;
  function?: string;
  target?: number | null;
  value?: number;
  markdown?: string;
};

function ChartFence({ body, fallback }: Readonly<{ body: string; fallback: FallbackCtx }>) {
  let spec: AnySpec | null = null;
  let err: string | null = null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object" && typeof parsed.kind === "string") {
      spec = parsed as AnySpec;
    } else {
      err = "missing 'kind' field";
    }
  } catch (e) {
    err = (e as Error).message;
  }
  if (!spec) {
    return (
      <div className="my-4 p-4 border border-[var(--coral)]/40 rounded-md font-mono text-[11px] text-[var(--coral)]">
        ▲ invalid altigen-chart fence: {err ?? "unknown error"}
      </div>
    );
  }

  // Hydrate from fallback if backend didn't inline data (defence in depth).
  const enriched = hydrate(spec, fallback);

  return (
    <div className="my-5 surface-soft p-3">
      <FenceBody spec={enriched} />
    </div>
  );
}

function FenceBody({ spec }: Readonly<{ spec: AnySpec }>) {
  switch (spec.kind) {
    case "kpi":
      return <KpiCard spec={spec} />;
    case "trend":
    case "sparkline":
    case "gauge":
    case "compare":
    case "heatmap":
      return (
        <PlotlyChart
          spec={spec as unknown as PlotlySpec}
          minHeight={spec.kind === "sparkline" ? 180 : spec.kind === "gauge" ? 320 : 360}
        />
      );
    case "products":
      return <ProductsTable rows={(spec.data as ProductRow[]) ?? []} title={spec.title} therapyArea={spec.therapyArea} />;
    case "trials":
      return <TrialsTable rows={(spec.data as TrialRow[]) ?? []} title={spec.title} />;
    case "note":
      return (
        <div className="p-2">
          {spec.title && <div className="kicker mb-1.5">[ {spec.title.toUpperCase()} ]</div>}
          <div className="text-[14.5px] text-[var(--bone-soft)] leading-relaxed whitespace-pre-wrap">{spec.markdown}</div>
        </div>
      );
    default:
      return (
        <div className="p-3 font-mono text-[11px] text-[var(--coral)]">
          ▲ unknown chart kind: {spec.kind}
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Fallback hydration — used only if the backend didn't inline data
// ---------------------------------------------------------------------------

function hydrate(spec: AnySpec, ctx: FallbackCtx): AnySpec {
  if (spec.data || spec.value != null) return spec;
  const out = { ...spec };
  switch (spec.kind) {
    case "trend":
    case "sparkline": {
      if (!spec.kpiName || !ctx.kpis) return out;
      const series = ctx.kpis
        .filter((k) => k.name === spec.kpiName)
        .sort((a, b) => a.period.localeCompare(b.period));
      if (series.length === 0) return out;
      out.unit   = series[0].unit;
      out.target = series[series.length - 1].target;
      out.data   = series.map((r) => ({ period: r.period, value: r.value }));
      return out;
    }
    case "kpi":
    case "gauge": {
      if (!spec.kpiName || !ctx.kpis) return out;
      const period = spec.period ?? "2026-Q1";
      const row = ctx.kpis.find((k) => k.name === spec.kpiName && k.period === period);
      if (!row) return out;
      out.value  = row.value;
      out.unit   = row.unit;
      out.target = row.target;
      out.function = row.function;
      out.period = row.period;
      return out;
    }
    case "compare": {
      if (!spec.kpiNames || !ctx.kpis) return out;
      const period = spec.period ?? "2026-Q1";
      const rows: { name: string; value: number; target: number | null; unit: string }[] = [];
      for (const name of spec.kpiNames) {
        const r = ctx.kpis.find((k) => k.name === name && k.period === period);
        if (r) rows.push({ name: r.name, value: r.value, target: r.target, unit: r.unit });
      }
      out.data = rows;
      return out;
    }
    case "heatmap": {
      if (!ctx.kpis) return out;
      const filtered = spec.function_
        ? ctx.kpis.filter((k) => k.function.toLowerCase() === spec.function_!.toLowerCase())
        : ctx.kpis;
      out.data = filtered;
      return out;
    }
    case "products": {
      if (!ctx.products) return out;
      out.data = spec.therapyArea
        ? ctx.products.filter((p) => p.therapy_area.toLowerCase() === spec.therapyArea!.toLowerCase())
        : ctx.products;
      return out;
    }
    case "trials": {
      if (!ctx.trials) return out;
      out.data = ctx.trials.filter((t) =>
        (!spec.productName || t.product.toLowerCase().includes(spec.productName.toLowerCase())) &&
        (!spec.phase  || t.phase  === spec.phase) &&
        (!spec.status || t.status.toLowerCase() === spec.status.toLowerCase()),
      );
      return out;
    }
    default:
      return out;
  }
}

// ---------------------------------------------------------------------------
// Non-chart renderers
// ---------------------------------------------------------------------------

function KpiCard({ spec }: Readonly<{ spec: AnySpec }>) {
  if (typeof spec.value !== "number") {
    return (
      <div className="p-6 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--coral)]">
        ▲ kpi card missing data
      </div>
    );
  }
  const target = spec.target ?? null;
  const t =
    target == null ? "neutral" :
    spec.value >= target ? "positive" :
    spec.value >= target * 0.95 ? "warning" :
    "critical";
  return (
    <div className="p-4">
      <div className="kicker">{spec.function ? `${spec.function} · ${spec.period ?? ""}` : spec.period}</div>
      <div className="text-[14px] text-[var(--bone-soft)] mt-2">{spec.title ?? spec.kpiName}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`font-display tracking-[-0.04em] leading-none text-[80px] tone-${t}`}>{spec.value}</span>
        <span className="font-mono text-[12px] tracking-wider text-[var(--muted)] uppercase">{spec.unit ?? ""}</span>
      </div>
      {target != null && (
        <div className="mt-3 font-mono text-[11px] tracking-wider text-[var(--muted)]">
          TARGET <span className="text-[var(--bone-soft)] tabular ml-1">{target}</span>
        </div>
      )}
    </div>
  );
}

type ProductRow = { name: string; indication: string; therapy_area?: string; status: string; launch_year?: number | null };

function ProductsTable({ rows, title, therapyArea }: Readonly<{ rows: ProductRow[]; title?: string; therapyArea?: string }>) {
  return (
    <div className="overflow-auto">
      <div className="px-3 pt-3 pb-2 border-b border-[var(--line)]">
        <div className="kicker">[ {therapyArea ?? "ALL"} · {rows.length.toString().padStart(2,"0")} ]</div>
        <div className="font-display-stand text-[19px] mt-1">{title ?? "Products"}</div>
      </div>
      <table className="w-full text-[14px]">
        <tbody>
          {rows.map((p) => (
            <tr key={p.name} className="border-t border-[var(--line)]">
              <td className="px-3 py-2.5 font-display-stand text-[16px]">{p.name}</td>
              <td className="py-2.5 pr-3 text-[var(--bone-soft)]">{p.indication}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-[11px] tracking-wider uppercase text-[var(--muted-hi)]">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TrialRow = { trial_id: string; product: string; phase: string; status: string; primary_endpoint?: string };

function TrialsTable({ rows, title }: Readonly<{ rows: TrialRow[]; title?: string }>) {
  return (
    <div className="overflow-auto">
      <div className="px-3 pt-3 pb-2 border-b border-[var(--line)]">
        <div className="kicker">[ {rows.length.toString().padStart(2,"0")} TRIALS ]</div>
        <div className="font-display-stand text-[19px] mt-1">{title ?? "Clinical trials"}</div>
      </div>
      <table className="w-full text-[14px]">
        <tbody>
          {rows.map((t) => (
            <tr key={t.trial_id} className="border-t border-[var(--line)]">
              <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--muted-hi)]">{t.trial_id}</td>
              <td className="py-2.5 pr-3 text-[var(--bone)]">{t.product}</td>
              <td className="py-2.5 pr-3 font-mono text-[11px] text-[var(--bone-soft)]">PH {t.phase}</td>
              <td className="py-2.5 pr-3 text-right text-[var(--muted-hi)] font-mono text-[10.5px] uppercase tracking-wider">{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

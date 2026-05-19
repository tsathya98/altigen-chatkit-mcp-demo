"use client";

/**
 * Command Palette — ⌘K / Ctrl-K from anywhere.
 *
 * One overlay, four kinds of actions:
 *   • Quick prompts ("Ask AI") — dispatch a question into the ChatKit dock.
 *   • Build templates       — call the agent's `create_dashboard` for you.
 *   • Navigate              — jump to /, /sandbox, login.
 *   • Reference items       — products, trials, KPIs (open the chat with a
 *                              focused prompt about them).
 *
 * No external deps; fuzzy match is a tiny token scorer in this file.
 */

import {
  ArrowUpRight,
  Beaker,
  Command as CmdIcon,
  Compass,
  FlaskConical,
  Gauge,
  History,
  LayoutGrid,
  LineChart,
  Mic,
  Moon,
  Package,
  PanelRight,
  Search,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  fetchKpis,
  fetchProducts,
  fetchTrials,
  type Kpi,
  type Product,
  type Trial,
} from "@/lib/api";
import { chatPrefill, chatSend } from "@/lib/chat-bridge";
import { getDockState, useDockState } from "@/lib/dock-state";
import {
  addWidget,
  clearSandbox,
  replaceSandbox,
} from "@/lib/sandbox-store";
import { useTheme } from "@/lib/theme-state";

type Section = "ai" | "build" | "nav" | "kpi" | "product" | "trial" | "settings";

type Item = {
  id: string;
  section: Section;
  label: string;
  hint?: string;
  badge?: string;
  Icon: any;
  keywords?: string;
  run: () => void;
};

const SECTION_LABEL: Record<Section, string> = {
  ai:       "Ask the assistant",
  build:    "Build a dashboard",
  nav:      "Navigate",
  kpi:      "Jump to KPI",
  product:  "Find a product",
  trial:    "Find a trial",
  settings: "Settings",
};

const SECTION_ORDER: Section[] = ["ai", "build", "nav", "kpi", "product", "trial", "settings"];

// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const [, setDock] = useDockState();
  const inputRef = useRef<HTMLInputElement>(null);

  const products = useSWR<Product[]>(open ? "products" : null, fetchProducts);
  const trials   = useSWR<Trial[]>(open ? "trials" : null, fetchTrials);
  const kpis     = useSWR<Kpi[]>(open ? "kpis" : null, () => fetchKpis());

  // ⌘K / Ctrl-K to toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset state on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const askPrompts: { label: string; hint?: string; q: string }[] = [
      { label: "Summarize Q1 KPIs vs target",            q: "Summarize every Q1 2026 KPI and tell me which ones are off target." },
      { label: "What's our right-first-time story?",     q: "Why is batch right-first-time below target this quarter? Cite the quality brief." },
      { label: "Show the on-time enrollment trend",      q: "How is on-time trial enrollment trending across the last six quarters?" },
      { label: "Zenoxitam: prescribing summary",         q: "Walk me through Zenoxitam's prescribing info — indication, dosage, contraindications, key adverse reactions." },
      { label: "Compare Immunoxa vs Glucotide",          q: "Compare Immunoxa and Glucotide — how is each performing in the last quarter?" },
      { label: "What products do we sell in Cardiology?",q: "List Altigen's cardiology products and their current status." },
    ];

    const buildTemplates: { label: string; hint: string; build: () => void }[] = [
      {
        label: "Adipara launch tracker",
        hint:  "KPI + trend + trials",
        build: () => {
          replaceSandbox({
            title: "Adipara launch tracker",
            subtitle: "Commercial, clinical, and quality signals for the obesity program.",
            widgets: [
              { kind: "kpi",      kpiName: "Net product revenue (Adipara)", period: "2026-Q1" },
              { kind: "trend",    kpiName: "Net product revenue (Adipara)" },
              { kind: "trials",   productName: "Adipara" },
              { kind: "note",     markdown: "Launched 2024 · obesity (BMI ≥ 30). Watch revenue ramp + safety signals in tandem." },
            ],
          });
          router.push("/sandbox");
        },
      },
      {
        label: "Quality watchlist",
        hint:  "RFT + manufacturing health",
        build: () => {
          replaceSandbox({
            title: "Quality & manufacturing watchlist",
            subtitle: "Right-first-time, deviations, and downstream commercial impact.",
            widgets: [
              { kind: "kpi",   kpiName: "Batch right-first-time", period: "2026-Q1" },
              { kind: "trend", kpiName: "Batch right-first-time" },
              { kind: "kpi",   kpiName: "Adverse-event reporting SLA", period: "2026-Q1" },
              { kind: "note",  markdown: "Q1 2026 — RFT 96.7% vs 98% target. Glucotide foil-seal escapes drove the gap, both lots cleared on manual re-inspection." },
            ],
          });
          router.push("/sandbox");
        },
      },
      {
        label: "Clinical operations board",
        hint:  "Enrollment + trial trends",
        build: () => {
          replaceSandbox({
            title: "Clinical operations",
            subtitle: "Enrollment performance, site activation, and trial pipeline.",
            widgets: [
              { kind: "kpi",      kpiName: "On-time trial enrollment", period: "2026-Q1" },
              { kind: "trend",    kpiName: "On-time trial enrollment" },
              { kind: "kpi",      kpiName: "Site activation cycle time", period: "2026-Q1" },
              { kind: "trials",   phase: "III" },
            ],
          });
          router.push("/sandbox");
        },
      },
    ];

    const ITEMS: Item[] = [];

    for (const p of askPrompts) {
      ITEMS.push({
        id: "ai:" + p.label,
        section: "ai",
        label: p.label,
        hint:  "↩ to send · ⌘↩ to prefill",
        badge: "AI",
        Icon: Sparkles,
        keywords: p.q,
        run: () => {
          chatSend(p.q);
          setOpen(false);
        },
      });
    }

    for (const t of buildTemplates) {
      ITEMS.push({
        id: "build:" + t.label,
        section: "build",
        label: t.label,
        hint:  t.hint,
        badge: "TEMPLATE",
        Icon: Wand2,
        run: () => { t.build(); setOpen(false); },
      });
    }

    ITEMS.push(
      {
        id: "nav:/",
        section: "nav",
        label: "Operations snapshot",
        hint:  "/",
        Icon: LayoutGrid,
        run: () => { router.push("/"); setOpen(false); },
      },
      {
        id: "nav:/sandbox",
        section: "nav",
        label: "Sandbox editor",
        hint:  "/sandbox",
        Icon: Beaker,
        run: () => { router.push("/sandbox"); setOpen(false); },
      },
      {
        id: "nav:chat",
        section: "nav",
        label: "Open chat dock",
        hint:  "⌘J",
        Icon: PanelRight,
        run: () => { setDock({ open: true, mode: "side" }); setOpen(false); },
      },
      {
        id: "nav:clear-sandbox",
        section: "nav",
        label: "Clear sandbox dashboard",
        hint:  "danger",
        Icon: PanelRight,
        run: () => {
          if (confirm("Clear the sandbox dashboard?")) clearSandbox();
          setOpen(false);
        },
      },
    );

    const distinctKpis = Array.from(
      new Map(
        (kpis.data ?? []).map((k) => [k.name, k] as const),
      ).values(),
    );

    for (const k of distinctKpis) {
      ITEMS.push({
        id: "kpi:" + k.name,
        section: "kpi",
        label: k.name,
        hint:  `${k.function} · target ${k.target ?? "—"} ${k.unit}`,
        badge: "KPI",
        Icon: LineChart,
        keywords: `${k.function} ${k.unit}`,
        run: () => {
          addWidget({ kind: "trend", kpiName: k.name });
          router.push("/sandbox");
          setOpen(false);
        },
      });
    }

    for (const p of products.data ?? []) {
      ITEMS.push({
        id: "p:" + p.name,
        section: "product",
        label: p.name,
        hint:  `${p.indication} · ${p.therapy_area} · ${p.status}`,
        badge: p.therapy_area,
        Icon: Package,
        keywords: `${p.indication} ${p.therapy_area} ${p.status}`,
        run: () => {
          chatSend(`Tell me about ${p.name} — indication, status, current trials, and how the brand is performing.`);
          setOpen(false);
        },
      });
    }

    for (const t of trials.data ?? []) {
      ITEMS.push({
        id: "t:" + t.trial_id,
        section: "trial",
        label: t.trial_id,
        hint:  `${t.product} · Phase ${t.phase} · ${t.status}`,
        badge: `PH ${t.phase}`,
        Icon: FlaskConical,
        keywords: `${t.product} ${t.primary_endpoint} ${t.status}`,
        run: () => {
          chatSend(`Give me the status of trial ${t.trial_id} (${t.product}) — enrollment, endpoint, anything noteworthy.`);
          setOpen(false);
        },
      });
    }

    ITEMS.push(
      {
        id: "set:theme",
        section: "settings",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        Icon: theme === "dark" ? Sun : Moon,
        run: () => { setTheme(theme === "dark" ? "light" : "dark"); setOpen(false); },
      },
      {
        id: "set:voice",
        section: "settings",
        label: "Toggle chat dock",
        hint:  "⌘J",
        Icon: Mic,
        run: () => { setDock({ open: !getDockState().open }); setOpen(false); },
      },
    );

    return ITEMS;
  }, [products.data, trials.data, kpis.data, router, theme, setTheme, setDock]);

  const filtered = useMemo(() => filterAndScore(items, query), [items, query]);

  // Cap cursor.
  useEffect(() => {
    if (cursor >= filtered.length) setCursor(Math.max(0, filtered.length - 1));
  }, [filtered, cursor]);

  const grouped = useMemo(() => groupBy(filtered, (it) => it.section), [filtered]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[14vh] px-4 bg-[var(--ink-deep)]/70 backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[640px] rounded-2xl bg-[var(--ink-soft)]/95 border border-[var(--line-hi)] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(122,243,208,0.12)] overflow-hidden dock-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* search */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]">
          <Search size={15} className="text-[var(--muted-hi)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(filtered.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                filtered[cursor]?.run();
              }
            }}
            placeholder="Search KPIs, products, trials, or ask the assistant…"
            className="flex-1 bg-transparent outline-none text-[15px] text-[var(--bone)] placeholder:text-[var(--muted)]"
          />
          <span className="font-mono text-[10px] text-[var(--muted)] tabular border border-[var(--line-hi)] rounded px-1.5 py-0.5">
            ESC
          </span>
        </div>

        {/* results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <CmdIcon size={20} className="mx-auto text-[var(--muted)] opacity-50" />
              <div className="kicker mt-3">[ Nothing matches ]</div>
              <p className="mt-2 text-[12.5px] text-[var(--muted-hi)] max-w-[360px] mx-auto leading-snug">
                Try a KPI name, product, trial ID, or just type a question and
                hit <span className="font-mono text-[var(--mint)]">↩</span> to ask the assistant.
              </p>
              {query.trim() && (
                <button
                  onClick={() => { chatSend(query.trim()); setOpen(false); }}
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-md border border-[var(--mint)]/40 bg-[var(--mint)]/[0.08] text-[var(--mint)] hover:bg-[var(--mint)]/[0.12]"
                >
                  <Sparkles size={11} /> Ask AI · "{truncate(query, 28)}"
                </button>
              )}
            </div>
          ) : (
            SECTION_ORDER.map((s) => {
              const rows = grouped[s];
              if (!rows?.length) return null;
              const startCursor = filtered.indexOf(rows[0]);
              return (
                <div key={s} className="px-2 py-1">
                  <div className="px-3 py-1 kicker text-[var(--muted)]">{SECTION_LABEL[s]}</div>
                  {rows.map((it) => {
                    const idx = filtered.indexOf(it);
                    return (
                      <Row
                        key={it.id}
                        item={it}
                        active={idx === cursor}
                        onHover={() => setCursor(idx)}
                        onActivate={(meta) => {
                          if (meta && it.section === "ai") {
                            chatPrefill(query.trim() || it.label);
                            setOpen(false);
                          } else {
                            it.run();
                          }
                        }}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--line)] font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--muted)]">
          <div className="flex items-center gap-3">
            <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navigate</span>
            <span><kbd className="kbd">↩</kbd> run</span>
            <span><kbd className="kbd">⌘</kbd><kbd className="kbd">↩</kbd> prefill</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Compass size={11} />
            <span>{filtered.length} / {items.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Row({
  item, active, onHover, onActivate,
}: Readonly<{
  item: Item;
  active: boolean;
  onHover: () => void;
  onActivate: (modifier: boolean) => void;
}>) {
  const Icon = item.Icon ?? ArrowUpRight;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={(e) => onActivate(e.metaKey || e.ctrlKey)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
        active
          ? "bg-[var(--mint)]/[0.08] text-[var(--bone)]"
          : "text-[var(--bone-soft)] hover:bg-[var(--surface-hi)]/40"
      }`}
    >
      <Icon size={14} className={active ? "text-[var(--mint)]" : "text-[var(--muted-hi)]"} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] truncate">{item.label}</div>
        {item.hint && (
          <div className="text-[11px] text-[var(--muted-hi)] truncate font-mono">
            {item.hint}
          </div>
        )}
      </div>
      {item.badge && (
        <span className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-[var(--muted)] border border-[var(--line-hi)] rounded px-1.5 py-0.5">
          {item.badge}
        </span>
      )}
      {active && <ArrowUpRight size={12} className="text-[var(--mint)]" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Filtering — tiny token-based fuzzy scorer. We tokenize the query and the
// item's label+hint+keywords, score by (substring hit + acronym hit + token
// proximity), then sort. Plenty good for ~100 items.
// ---------------------------------------------------------------------------

function filterAndScore(items: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: { it: Item; s: number }[] = [];
  for (const it of items) {
    const hay = (it.label + " " + (it.hint ?? "") + " " + (it.keywords ?? "")).toLowerCase();
    let s = 0;
    let allHit = true;
    for (const t of tokens) {
      if (hay.includes(t)) {
        s += 10;
        if (it.label.toLowerCase().startsWith(t)) s += 5;
      } else {
        allHit = false;
        break;
      }
    }
    if (allHit) scored.push({ it, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.it);
}

function groupBy<T, K extends string>(arr: T[], k: (t: T) => K): Record<K, T[]> {
  return arr.reduce<Record<K, T[]>>((acc, x) => {
    const key = k(x);
    (acc[key] ??= [] as T[]).push(x);
    return acc;
  }, {} as Record<K, T[]>);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

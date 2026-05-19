"use client";

/**
 * Live agent activity panel — the centerpiece of the MCP demo.
 *
 * Renders the most recent MCP tool calls, vector-store searches, and
 * client-side tool invocations in a glassy bottom-left floating panel.
 * Collapsible. Auto-expands on incoming activity. Pulses while a call
 * is in-flight.
 */

import {
  Activity,
  ArrowUpRight,
  Brain,
  ChevronDown,
  ChevronUp,
  Database,
  FileSearch,
  MousePointerClick,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearActivity, useActivity, type ActivityEvent } from "@/lib/activity-store";
import { dockReservesSpace, useDockState } from "@/lib/dock-state";

const KIND_LABEL: Record<string, { label: string; tone: string; Icon: any }> = {
  mcp_call:       { label: "MCP",     tone: "mint",   Icon: Database },
  mcp_result:     { label: "MCP ✓",   tone: "mint",   Icon: Database },
  rag_query:      { label: "RAG",     tone: "amber",  Icon: FileSearch },
  rag_result:     { label: "RAG ✓",   tone: "amber",  Icon: FileSearch },
  tool_call:      { label: "TOOL",    tone: "violet", Icon: Wrench },
  tool_result:    { label: "TOOL ✓",  tone: "violet", Icon: Wrench },
  client_tool:    { label: "UI",      tone: "violet", Icon: MousePointerClick },
  agent_message:  { label: "AGENT",   tone: "bone",   Icon: Sparkles },
  agent_thinking: { label: "THINK",   tone: "bone",   Icon: Brain },
  user_message:   { label: "YOU",     tone: "bone",   Icon: ArrowUpRight },
  info:           { label: "INFO",    tone: "bone",   Icon: Activity },
};

const TONE_CLASS: Record<string, string> = {
  mint:   "text-[var(--mint)] border-[var(--mint)]/40 bg-[var(--mint)]/[0.06]",
  amber:  "text-[var(--amber)] border-[var(--amber)]/40 bg-[var(--amber)]/[0.06]",
  violet: "text-[var(--violet)] border-[var(--violet)]/40 bg-[var(--violet)]/[0.06]",
  bone:   "text-[var(--bone-soft)] border-[var(--line-hi)] bg-[var(--surface-hi)]/40",
};

export function AgentActivity() {
  const all = useActivity();
  const [dock] = useDockState();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);
  const lastCountRef = useRef(0);

  // Auto-uncollapse when new activity arrives.
  useEffect(() => {
    if (all.length > lastCountRef.current && hidden) {
      setHidden(false);
    }
    lastCountRef.current = all.length;
  }, [all.length, hidden]);

  // Pair start/end calls so "tool_call" → "tool_result" merges to one row.
  const merged = useMemo(() => mergeCalls(all), [all]);

  // Pulse if any call is in-flight (started but not yet finished).
  const inFlight = merged.some((m) => m.inFlight);

  // Position: bottom-left, but shift if the side dock is wide so we don't
  // overlap the launcher pill in the bottom-right.
  const reservesRight = dockReservesSpace(dock);

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)]/80 backdrop-blur-md border border-[var(--line-hi)] text-[var(--bone-soft)] hover:text-[var(--bone)] hover:border-[var(--mint)]/40 transition-colors shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]"
        title="Show agent activity"
      >
        <Activity size={13} className={inFlight ? "text-[var(--mint)] animate-pulse" : ""} />
        <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase">Activity</span>
        {merged.length > 0 && (
          <span className="font-mono text-[10px] text-[var(--muted-hi)] tabular">{merged.length}</span>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-40 w-[360px] max-h-[60vh] flex flex-col rounded-xl bg-[var(--ink-soft)]/90 backdrop-blur-xl border border-[var(--line-hi)] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)] dock-pop"
      style={reservesRight ? { /* dock is on the right, we stay on the left */ } : {}}
    >
      {/* header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              inFlight ? "bg-[var(--mint)] dot-breathe" : "bg-[var(--muted)]"
            }`}
            style={inFlight ? { boxShadow: "0 0 10px var(--mint)" } : undefined}
          />
          <span className="kicker truncate">[ Agent Activity ]</span>
          <span className="ml-1 font-mono text-[10px] text-[var(--muted)] tabular">
            {merged.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand" : "Collapse"}
            className="p-1 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)]"
          >
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            onClick={() => clearActivity()}
            title="Clear"
            className="p-1 rounded-md text-[var(--muted-hi)] hover:text-[var(--coral)] hover:bg-[var(--surface-hi)]"
          >
            <Wrench size={11} />
          </button>
          <button
            onClick={() => setHidden(true)}
            title="Hide"
            className="p-1 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)]"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {merged.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <Activity size={20} className="mx-auto text-[var(--muted)] opacity-50" />
              <div className="kicker mt-3">[ Waiting for activity ]</div>
              <p className="mt-2 text-[12px] text-[var(--muted-hi)] leading-snug">
                Ask the assistant a question — every MCP call, vector-store
                query, and UI mutation will land here in real time.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {merged.map((m) => (
                <ActivityRow
                  key={m.key}
                  ev={m}
                  expanded={expandedIds.has(m.key)}
                  onToggle={() =>
                    setExpandedIds((s) => {
                      const next = new Set(s);
                      if (next.has(m.key)) next.delete(m.key);
                      else next.add(m.key);
                      return next;
                    })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type MergedRow = {
  key: string;
  kind: string;
  name?: string;
  text?: string;
  args?: unknown;
  result?: unknown;
  startedTs: number;
  endedTs?: number;
  inFlight: boolean;
};

function mergeCalls(events: ActivityEvent[]): MergedRow[] {
  // events are newest-first; collapse "_call" + matching "_result" into a row.
  const ordered = [...events].sort((a, b) => a.ts - b.ts);
  const byCall: Record<string, MergedRow> = {};
  const others: MergedRow[] = [];

  for (const ev of ordered) {
    const isResult = ev.kind.endsWith("_result");
    const isCall =
      ev.kind === "mcp_call" ||
      ev.kind === "rag_query" ||
      ev.kind === "tool_call" ||
      ev.kind === "client_tool";

    const callId = ev.call_id ?? (ev.name ? `${ev.kind}:${ev.name}:${ev.ts}` : undefined);

    if (isCall && callId) {
      byCall[callId] = {
        key: callId,
        kind: ev.kind,
        name: ev.name,
        args: ev.arguments,
        startedTs: ev.ts,
        inFlight: true,
      };
      continue;
    }
    if (isResult) {
      const target = ev.call_id ? byCall[ev.call_id] : undefined;
      if (target) {
        target.result = ev.result;
        target.endedTs = ev.ts;
        target.inFlight = false;
        // Promote the kind to the result variant so the icon shows ✓.
        target.kind = ev.kind;
        continue;
      }
    }
    // Anything else (messages, info) becomes its own row.
    others.push({
      key: ev.id,
      kind: ev.kind,
      name: ev.name,
      text: ev.text,
      args: ev.arguments,
      result: ev.result,
      startedTs: ev.ts,
      inFlight: false,
    });
  }

  return [...Object.values(byCall), ...others].sort((a, b) => b.startedTs - a.startedTs);
}

function ActivityRow({
  ev, expanded, onToggle,
}: Readonly<{ ev: MergedRow; expanded: boolean; onToggle: () => void }>) {
  const cfg = KIND_LABEL[ev.kind] ?? KIND_LABEL.info;
  const tone = TONE_CLASS[cfg.tone] ?? TONE_CLASS.bone;
  const ago = useAgo(ev.startedTs);
  const dur = ev.endedTs ? Math.max(0, Math.round((ev.endedTs - ev.startedTs) * 1000)) : null;

  const Icon = cfg.Icon;
  const hasDetail = ev.args || ev.result || ev.text;

  return (
    <li className="rounded-md border border-transparent hover:border-[var(--line-hi)] hover:bg-[var(--surface-hi)]/40 transition-colors">
      <button
        type="button"
        onClick={hasDetail ? onToggle : undefined}
        className="w-full text-left flex items-start gap-2 px-2 py-1.5"
      >
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-[0.16em] uppercase shrink-0 ${tone}`}>
          <Icon size={9} />
          <span>{cfg.label}</span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[11.5px] text-[var(--bone)] truncate">
              {ev.name ?? (ev.text ? truncate(ev.text, 60) : ev.kind)}
              {ev.inFlight && <span className="text-[var(--mint)] ml-1.5">…</span>}
            </span>
            <span className="font-mono text-[9.5px] tabular text-[var(--muted)] shrink-0">
              {dur != null ? `${dur}ms` : ago}
            </span>
          </div>
          {ev.args ? (
            <div className="font-mono text-[10.5px] text-[var(--muted-hi)] truncate">
              {formatArgs(ev.args)}
            </div>
          ) : null}
        </div>
      </button>

      {expanded && hasDetail && (
        <div className="px-2 pb-2 -mt-1 space-y-1.5">
          {ev.args !== undefined && (
            <DetailBlock label="args" value={ev.args} />
          )}
          {ev.result !== undefined && (
            <DetailBlock label={ev.kind.includes("rag") ? "matches" : "result"} value={ev.result} />
          )}
          {ev.text && <DetailBlock label="text" value={ev.text} />}
        </div>
      )}
    </li>
  );
}

function DetailBlock({ label, value }: Readonly<{ label: string; value: unknown }>) {
  let body: string;
  try {
    body = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    body = String(value);
  }
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--muted)] mb-0.5">
        {label}
      </div>
      <pre className="font-mono text-[10.5px] text-[var(--bone-soft)] bg-[var(--ink)]/60 rounded border border-[var(--line)] p-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-all">
        {body}
      </pre>
    </div>
  );
}

function formatArgs(args: unknown): string {
  if (args == null) return "";
  if (typeof args === "string") {
    try { return formatArgs(JSON.parse(args)); } catch { return args; }
  }
  if (typeof args === "object") {
    const entries = Object.entries(args as Record<string, unknown>).slice(0, 4);
    if (!entries.length) return "{}";
    return entries
      .map(([k, v]) =>
        `${k}=${typeof v === "string" ? `"${truncate(v, 22)}"` : truncate(JSON.stringify(v), 22)}`,
      )
      .join("  ");
  }
  return String(args);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function useAgo(ts: number): string {
  const [_, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - ts));
  if (seconds < 1) return "just now";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

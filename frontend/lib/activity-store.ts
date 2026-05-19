"use client";

/**
 * Live activity store — subscribed by the AgentActivity panel.
 *
 * Reads server-sent events from /api/activity/stream (MCP tool calls,
 * vector-store searches, agent messages) and also accepts client-side
 * pushes from agent-tools.ts when the agent invokes a browser tool.
 *
 * Pure module-level state + listener set, same shape as dock-state.
 */

import { useEffect, useReducer } from "react";

export type ActivityKind =
  | "user_message"
  | "agent_message"
  | "agent_thinking"
  | "tool_call"
  | "tool_result"
  | "mcp_call"
  | "mcp_result"
  | "rag_query"
  | "rag_result"
  | "client_tool"
  | "info";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  ts: number;             // seconds since epoch (matches backend)
  name?: string;
  call_id?: string;
  arguments?: unknown;
  result?: unknown;
  text?: string;
  thread_id?: string | null;
};

const MAX = 80;

let events: ActivityEvent[] = [];
let listeners = new Set<() => void>();
let connected = false;
let es: EventSource | null = null;

function emit(): void {
  listeners.forEach((fn) => fn());
}

function push(ev: ActivityEvent): void {
  // De-dupe by id (SSE replays the backlog on reconnect).
  if (events.some((e) => e.id === ev.id)) return;
  events = [ev, ...events].slice(0, MAX);
  emit();
}

function connect(): void {
  if (connected || typeof window === "undefined") return;
  connected = true;
  try {
    es = new EventSource("/api/activity/stream");
    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as ActivityEvent;
        if (parsed && parsed.id) push(parsed);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* keep socket alive — browser EventSource auto-reconnects */
    };
  } catch (err) {
    console.warn("[activity] failed to open SSE", err);
    connected = false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function pushClientActivity(ev: Omit<ActivityEvent, "id" | "ts" | "kind"> & {
  kind?: ActivityKind;
}): void {
  const event: ActivityEvent = {
    id: "c_" + Math.random().toString(36).slice(2, 12),
    ts: Date.now() / 1000,
    kind: ev.kind ?? "client_tool",
    ...ev,
  };
  push(event);
  // Mirror up to the backend so other tabs / observers see it too.
  fetch("/api/activity/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {
    /* fire-and-forget */
  });
}

export function clearActivity(): void {
  events = [];
  emit();
}

export function getActivity(): ActivityEvent[] {
  return events;
}

export function useActivity(): ActivityEvent[] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    connect();
    listeners.add(force);
    force();
    return () => {
      listeners.delete(force);
    };
  }, []);
  return events;
}

// Convenience: a small derived stat for header badges.
export function useActivityStats() {
  const all = useActivity();
  const lastMin = Date.now() / 1000 - 60;
  const recent = all.filter((e) => e.ts > lastMin);
  return {
    total: all.length,
    recent: recent.length,
    mcpCalls: all.filter((e) => e.kind === "mcp_call" || e.kind === "mcp_result").length,
    ragQueries: all.filter((e) => e.kind === "rag_query" || e.kind === "rag_result").length,
    lastEvent: all[0],
  };
}

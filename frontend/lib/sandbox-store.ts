"use client";

/**
 * Shared sandbox-dashboard store.
 *
 * Both the sandbox UI and the chat / voice agent mutate this. State is
 * persisted to localStorage so navigating away and back keeps the layout.
 * Same shape as dock-state.ts: module-level state + listener set + a hook
 * that subscribes.
 */

import { useEffect, useReducer } from "react";

export type Widget =
  | { id: string; kind: "kpi";       title?: string; kpiName: string; period?: string }
  | { id: string; kind: "trend";     title?: string; kpiName: string }
  | { id: string; kind: "gauge";     title?: string; kpiName: string; period?: string }
  | { id: string; kind: "sparkline"; title?: string; kpiName: string }
  | { id: string; kind: "heatmap";   title?: string; function_?: string }
  | { id: string; kind: "compare";   title?: string; kpiNames: string[]; period?: string }
  | { id: string; kind: "products";  title?: string; therapyArea?: string }
  | { id: string; kind: "trials";    title?: string; productName?: string; phase?: string; status?: string }
  | { id: string; kind: "note";      title?: string; markdown: string };

export type WidgetKind = Widget["kind"];

export type Sandbox = {
  title: string;
  subtitle?: string;
  widgets: Widget[];
  updatedAt: number;
};

const KEY = "altigen-sandbox-v1";

const DEFAULT: Sandbox = {
  title: "Untitled dashboard",
  subtitle: "Build a workspace by asking the assistant — by voice or by text.",
  widgets: [],
  updatedAt: 0,
};

let state: Sandbox = { ...DEFAULT };
const listeners = new Set<() => void>();
let initialized = false;

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Sandbox;
      if (p && Array.isArray(p.widgets)) state = { ...DEFAULT, ...p };
    }
  } catch {
    /* ignore */
  }
}

function persist(): void {
  state = { ...state, updatedAt: Date.now() };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((fn) => fn());
}

function genId(): string {
  return "w_" + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Mutations — exported for the UI buttons AND for the agent tool handlers.
// ---------------------------------------------------------------------------

export function getSandbox(): Sandbox {
  return state;
}

export function setSandboxMeta(patch: Pick<Partial<Sandbox>, "title" | "subtitle">): void {
  state = { ...state, ...patch };
  persist();
}

// Mirror of Widget without `id`, kept as an explicit discriminated union so
// TypeScript narrows correctly at call sites (`Omit<Widget, "id">` collapses
// the variants into a single shape and breaks narrowing).
export type WidgetInput =
  | { kind: "kpi";       title?: string; kpiName: string; period?: string }
  | { kind: "trend";     title?: string; kpiName: string }
  | { kind: "gauge";     title?: string; kpiName: string; period?: string }
  | { kind: "sparkline"; title?: string; kpiName: string }
  | { kind: "heatmap";   title?: string; function_?: string }
  | { kind: "compare";   title?: string; kpiNames: string[]; period?: string }
  | { kind: "products";  title?: string; therapyArea?: string }
  | { kind: "trials";    title?: string; productName?: string; phase?: string; status?: string }
  | { kind: "note";      title?: string; markdown: string };

export function addWidget(input: WidgetInput): Widget {
  const widget = { ...input, id: genId() } as Widget;
  state = { ...state, widgets: [...state.widgets, widget] };
  persist();
  return widget;
}

export function removeWidget(id: string): void {
  state = { ...state, widgets: state.widgets.filter((w) => w.id !== id) };
  persist();
}

export function updateWidget(id: string, patch: Partial<Widget>): void {
  state = {
    ...state,
    widgets: state.widgets.map((w) => (w.id === id ? ({ ...w, ...patch } as Widget) : w)),
  };
  persist();
}

export function reorderWidgets(fromId: string, toId: string): void {
  if (fromId === toId) return;
  const from = state.widgets.findIndex((w) => w.id === fromId);
  const to   = state.widgets.findIndex((w) => w.id === toId);
  if (from < 0 || to < 0) return;
  const next = [...state.widgets];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  state = { ...state, widgets: next };
  persist();
}

export function moveWidget(id: string, direction: -1 | 1): void {
  const i = state.widgets.findIndex((w) => w.id === id);
  if (i < 0) return;
  const j = i + direction;
  if (j < 0 || j >= state.widgets.length) return;
  const next = [...state.widgets];
  [next[i], next[j]] = [next[j], next[i]];
  state = { ...state, widgets: next };
  persist();
}

export function replaceSandbox(input: {
  title?: string;
  subtitle?: string;
  widgets?: ReadonlyArray<WidgetInput | Widget>;
}): Sandbox {
  const widgets: Widget[] = (input.widgets ?? []).map((w) => {
    const hasId = typeof (w as { id?: unknown }).id === "string";
    return (hasId ? (w as Widget) : ({ ...(w as WidgetInput), id: genId() } as Widget));
  });
  state = {
    title: input.title ?? state.title,
    subtitle: input.subtitle ?? state.subtitle,
    widgets,
    updatedAt: Date.now(),
  };
  persist();
  return state;
}

export function clearSandbox(): void {
  state = { ...DEFAULT };
  persist();
}

// ---------------------------------------------------------------------------

export function useSandbox(): Sandbox {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    init();
    listeners.add(force);
    force();
    return () => {
      listeners.delete(force);
    };
  }, []);
  return state;
}

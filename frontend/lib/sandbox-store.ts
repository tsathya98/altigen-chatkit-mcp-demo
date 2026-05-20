"use client";

/**
 * Sandbox dashboard store — Power BI-style multi-dashboard editor.
 *
 * Each dashboard owns a list of widgets, a set of global filters (period,
 * therapy area, function) that widgets fall back to when their own props
 * are blank, and a free-form grid layout (every widget has x/y/w/h in grid
 * cells).
 *
 * State is module-level with a listener set, persisted to localStorage,
 * migrated transparently from the previous single-dashboard shape.
 */

import { useEffect, useReducer } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GridPos = { x: number; y: number; w: number; h: number };

export type Widget =
  | { id: string; kind: "kpi";       pos: GridPos; title?: string; kpiName: string; period?: string }
  | { id: string; kind: "trend";     pos: GridPos; title?: string; kpiName: string; variant?: "area" | "line" }
  | { id: string; kind: "gauge";     pos: GridPos; title?: string; kpiName: string; period?: string }
  | { id: string; kind: "sparkline"; pos: GridPos; title?: string; kpiName: string }
  | { id: string; kind: "heatmap";   pos: GridPos; title?: string; function_?: string }
  | { id: string; kind: "compare";   pos: GridPos; title?: string; kpiNames: string[]; period?: string }
  | { id: string; kind: "products";  pos: GridPos; title?: string; therapyArea?: string }
  | { id: string; kind: "trials";    pos: GridPos; title?: string; productName?: string; phase?: string; status?: string }
  | { id: string; kind: "note";      pos: GridPos; title?: string; markdown: string };

export type WidgetKind = Widget["kind"];

export type WidgetInput =
  | { kind: "kpi";       title?: string; kpiName: string; period?: string;       pos?: Partial<GridPos> }
  | { kind: "trend";     title?: string; kpiName: string; variant?: "area" | "line"; pos?: Partial<GridPos> }
  | { kind: "gauge";     title?: string; kpiName: string; period?: string;       pos?: Partial<GridPos> }
  | { kind: "sparkline"; title?: string; kpiName: string;                         pos?: Partial<GridPos> }
  | { kind: "heatmap";   title?: string; function_?: string;                      pos?: Partial<GridPos> }
  | { kind: "compare";   title?: string; kpiNames: string[]; period?: string;    pos?: Partial<GridPos> }
  | { kind: "products";  title?: string; therapyArea?: string;                    pos?: Partial<GridPos> }
  | { kind: "trials";    title?: string; productName?: string; phase?: string; status?: string; pos?: Partial<GridPos> }
  | { kind: "note";      title?: string; markdown: string;                        pos?: Partial<GridPos> };

export type GlobalFilters = {
  period?: string;
  therapyArea?: string;
  function?: string;
};

export type Dashboard = {
  id: string;
  title: string;
  subtitle?: string;
  widgets: Widget[];
  filters: GlobalFilters;
  updatedAt: number;
};

export type SandboxState = {
  dashboards: Record<string, Dashboard>;
  order: string[];   // display order in sidebar
  activeId: string;
};

// ---------------------------------------------------------------------------
// Constants — grid system
// ---------------------------------------------------------------------------

export const COLS = 12;       // canvas is 12 cells wide
export const ROW_PX = 80;     // each row is 80px tall
export const GAP_PX = 8;      // gap between cells
export const MIN_W = 2;
export const MIN_H = 2;
export const DEFAULT_SIZE: Record<WidgetKind, { w: number; h: number }> = {
  kpi:       { w: 3, h: 3 },
  trend:     { w: 6, h: 4 },
  gauge:     { w: 4, h: 4 },
  sparkline: { w: 4, h: 3 },
  heatmap:   { w: 8, h: 4 },
  compare:   { w: 4, h: 4 },
  products:  { w: 6, h: 4 },
  trials:    { w: 6, h: 4 },
  note:      { w: 4, h: 2 },
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const KEY = "altigen-sandbox-v2";
const LEGACY_KEY = "altigen-sandbox-v1";

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function blankDashboard(title = "Untitled dashboard", subtitle?: string): Dashboard {
  return {
    id: genId("dash"),
    title,
    subtitle,
    widgets: [],
    filters: {},
    updatedAt: Date.now(),
  };
}

function defaultState(): SandboxState {
  const d = blankDashboard(
    "Untitled dashboard",
    "Pick widgets from the menu — or ask the assistant.",
  );
  return { dashboards: { [d.id]: d }, order: [d.id], activeId: d.id };
}

let state: SandboxState = defaultState();
const listeners = new Set<() => void>();
let initialized = false;

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SandboxState;
      if (parsed && parsed.dashboards && parsed.activeId) {
        state = parsed;
        return;
      }
    }
    // Migrate from v1: single dashboard with un-positioned widgets.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy) as { title?: string; subtitle?: string; widgets?: any[] };
      const d = blankDashboard(p.title ?? "Untitled dashboard", p.subtitle);
      const widgets = (p.widgets ?? []).map((w, i) => positionForMigration(w, i));
      d.widgets = widgets;
      state = { dashboards: { [d.id]: d }, order: [d.id], activeId: d.id };
      persist();
    }
  } catch {
    /* ignore */
  }
}

function positionForMigration(w: any, i: number): Widget {
  const size = DEFAULT_SIZE[w.kind as WidgetKind] ?? { w: 4, h: 3 };
  // Auto-place in a simple 2-up flow.
  const x = (i % 2) * 6;
  const y = Math.floor(i / 2) * size.h;
  return { ...w, pos: { x, y, w: size.w, h: size.h } } as Widget;
}

function persist(): void {
  state = patchActive((d) => ({ ...d, updatedAt: Date.now() }));
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }
  listeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export function getSandbox(): SandboxState { return state; }

export function getActiveDashboard(): Dashboard {
  return state.dashboards[state.activeId];
}

function patchActive(fn: (d: Dashboard) => Dashboard): SandboxState {
  const d = state.dashboards[state.activeId];
  if (!d) return state;
  const next = fn(d);
  return {
    ...state,
    dashboards: { ...state.dashboards, [d.id]: next },
  };
}

// ---------------------------------------------------------------------------
// Dashboard-level mutations
// ---------------------------------------------------------------------------

export function setActiveDashboard(id: string): void {
  if (!state.dashboards[id]) return;
  state = { ...state, activeId: id };
  persist();
}

export function newDashboard(title = "Untitled dashboard", subtitle?: string): Dashboard {
  const d = blankDashboard(title, subtitle);
  state = {
    ...state,
    dashboards: { ...state.dashboards, [d.id]: d },
    order: [...state.order, d.id],
    activeId: d.id,
  };
  persist();
  return d;
}

export function renameDashboard(id: string, title: string, subtitle?: string): void {
  if (!state.dashboards[id]) return;
  state = {
    ...state,
    dashboards: {
      ...state.dashboards,
      [id]: { ...state.dashboards[id], title, subtitle: subtitle ?? state.dashboards[id].subtitle },
    },
  };
  persist();
}

export function duplicateDashboard(id: string): Dashboard | null {
  const src = state.dashboards[id];
  if (!src) return null;
  const copy: Dashboard = {
    ...src,
    id: genId("dash"),
    title: src.title + " (copy)",
    widgets: src.widgets.map((w) => ({ ...w, id: genId("w") } as Widget)),
    updatedAt: Date.now(),
  };
  state = {
    ...state,
    dashboards: { ...state.dashboards, [copy.id]: copy },
    order: [...state.order, copy.id],
    activeId: copy.id,
  };
  persist();
  return copy;
}

export function deleteDashboard(id: string): void {
  if (!state.dashboards[id]) return;
  const { [id]: _, ...rest } = state.dashboards;
  const newOrder = state.order.filter((x) => x !== id);
  if (newOrder.length === 0) {
    // Always keep at least one dashboard.
    const d = blankDashboard();
    state = { dashboards: { [d.id]: d }, order: [d.id], activeId: d.id };
  } else {
    const activeId = state.activeId === id ? newOrder[0] : state.activeId;
    state = { dashboards: rest, order: newOrder, activeId };
  }
  persist();
}

export function setFilters(patch: Partial<GlobalFilters>): void {
  state = patchActive((d) => ({ ...d, filters: { ...d.filters, ...patch } }));
  persist();
}

export function clearFilters(): void {
  state = patchActive((d) => ({ ...d, filters: {} }));
  persist();
}

export function setSandboxMeta(patch: { title?: string; subtitle?: string }): void {
  state = patchActive((d) => ({
    ...d,
    title: patch.title ?? d.title,
    subtitle: patch.subtitle ?? d.subtitle,
  }));
  persist();
}

// ---------------------------------------------------------------------------
// Widget-level mutations
// ---------------------------------------------------------------------------

function nextFreeRow(widgets: Widget[]): number {
  return widgets.reduce((m, w) => Math.max(m, w.pos.y + w.pos.h), 0);
}

function placeFor(kind: WidgetKind, widgets: Widget[], hint?: Partial<GridPos>): GridPos {
  const def = DEFAULT_SIZE[kind] ?? { w: 4, h: 3 };
  const w = clamp(hint?.w ?? def.w, MIN_W, COLS);
  const h = clamp(hint?.h ?? def.h, MIN_H, 99);
  const y = hint?.y ?? nextFreeRow(widgets);
  const x = clamp(hint?.x ?? 0, 0, COLS - w);
  return { x, y, w, h };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function addWidget(input: WidgetInput): Widget {
  const widgets = state.dashboards[state.activeId]?.widgets ?? [];
  const pos = placeFor(input.kind, widgets, input.pos);
  const { pos: _ignored, ...rest } = input as WidgetInput & { pos?: unknown };
  const widget = { ...(rest as object), id: genId("w"), pos } as Widget;
  state = patchActive((d) => ({ ...d, widgets: [...d.widgets, widget] }));
  persist();
  return widget;
}

export function removeWidget(id: string): void {
  state = patchActive((d) => ({ ...d, widgets: d.widgets.filter((w) => w.id !== id) }));
  persist();
}

export function updateWidget(id: string, patch: Partial<Widget>): void {
  state = patchActive((d) => ({
    ...d,
    widgets: d.widgets.map((w) => (w.id === id ? ({ ...w, ...patch } as Widget) : w)),
  }));
  persist();
}

export function moveWidgetTo(id: string, pos: GridPos): void {
  const safe: GridPos = {
    x: clamp(pos.x, 0, COLS - 1),
    y: Math.max(0, pos.y),
    w: clamp(pos.w, MIN_W, COLS),
    h: Math.max(MIN_H, pos.h),
  };
  if (safe.x + safe.w > COLS) safe.x = COLS - safe.w;
  state = patchActive((d) => ({
    ...d,
    widgets: d.widgets.map((w) => (w.id === id ? ({ ...w, pos: safe } as Widget) : w)),
  }));
  persist();
}

export function reorderWidgets(_fromId: string, _toId: string): void {
  // No-op in the grid layout; kept for back-compat with WidgetRenderer.
  // Drag-and-drop now moves widgets by changing pos directly.
}

export function moveWidget(_id: string, _direction: -1 | 1): void {
  // Legacy up/down buttons — also no-ops on the grid. Kept so old callers
  // don't crash; the renderer no longer shows these buttons.
}

export function replaceSandbox(input: {
  title?: string;
  subtitle?: string;
  widgets?: ReadonlyArray<WidgetInput | Widget>;
}): Dashboard {
  const widgets: Widget[] = [];
  for (const w of input.widgets ?? []) {
    const hasPos = !!(w as Widget).pos && typeof (w as Widget).pos?.x === "number";
    if (hasPos && (w as Widget).id) {
      widgets.push(w as Widget);
    } else {
      const pos = placeFor((w as WidgetInput).kind, widgets, (w as WidgetInput).pos);
      const { pos: _ignored, ...rest } = w as any;
      widgets.push({ ...(rest as object), id: genId("w"), pos } as Widget);
    }
  }
  state = patchActive((d) => ({
    ...d,
    title: input.title ?? d.title,
    subtitle: input.subtitle ?? d.subtitle,
    widgets,
    updatedAt: Date.now(),
  }));
  persist();
  return getActiveDashboard();
}

export function clearSandbox(): void {
  state = patchActive((d) => ({ ...d, widgets: [], updatedAt: Date.now() }));
  persist();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useSandboxState(): SandboxState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    init();
    listeners.add(force);
    force();
    return () => { listeners.delete(force); };
  }, []);
  return state;
}

export function useSandbox(): Dashboard {
  useSandboxState();
  return getActiveDashboard();
}

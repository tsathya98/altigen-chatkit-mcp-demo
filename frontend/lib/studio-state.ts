"use client";

/**
 * Studio canvas state — open-ended, backend-driven.
 *
 * The canvas no longer carries a fixed widget spec. Instead the agent
 * sends markdown content (with optional `altigen-chart` fenced-code
 * blocks that the renderer turns into live charts). This is the
 * Claude/ChatGPT-canvas pattern: the model writes a document, the
 * frontend just renders it.
 *
 * State is in-memory only — one canvas at a time.
 */

import { useEffect, useReducer } from "react";

export type StudioState = {
  open: boolean;
  title: string | null;
  /** Markdown body. May contain ```altigen-chart {…} ``` code fences that
   *  the renderer replaces with live KPI/trend/gauge/etc. widgets. */
  content: string;
  /** Increments on every backend update so the renderer remounts and
   *  chart enter-animations replay. */
  rev: number;
};

let state: StudioState = { open: false, title: null, content: "", rev: 0 };
const listeners = new Set<() => void>();

function notify(): void { listeners.forEach((fn) => fn()); }

export function getStudio(): StudioState { return state; }

/** Replace the canvas content wholesale and open the pane. Called by the
 *  client-side handler for the `update_canvas` agent tool. */
export function updateCanvas(opts: { title?: string | null; content: string }): void {
  state = {
    open: true,
    title: opts.title ?? null,
    content: opts.content ?? "",
    rev: state.rev + 1,
  };
  notify();
}

/** Append more content to the existing canvas (for follow-up edits the
 *  agent wants to layer on without rewriting from scratch). */
export function appendCanvas(content: string): void {
  state = {
    ...state,
    open: true,
    content: state.content + "\n\n" + content,
    rev: state.rev + 1,
  };
  notify();
}

export function closeCanvas(): void {
  state = { ...state, open: false };
  notify();
}

export function toggleCanvas(): void {
  if (!state.content) return;
  state = { ...state, open: !state.open };
  notify();
}

export function clearCanvas(): void {
  state = { open: false, title: null, content: "", rev: state.rev + 1 };
  notify();
}

export function useStudio(): StudioState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => { listeners.delete(force); };
  }, []);
  return state;
}

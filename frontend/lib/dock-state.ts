"use client";

/**
 * Tiny shared store for the chat dock — used by ChatDock and DashboardClient
 * so the layout reserves padding only when the chat is actually visible,
 * the side rail's width is user-resizable, and the ChatKit instance can stay
 * mounted across mode changes (which is what preserves the active session).
 */

import { useEffect, useReducer } from "react";

export type DockMode = "side" | "floating" | "fullscreen";
export type DockState = { mode: DockMode; open: boolean; width: number };

const KEY = "altigen-dock-v3";
const DEFAULT_WIDTH = 420;
export const MIN_WIDTH = 360;
export const MAX_WIDTH = 760;

let state: DockState = { mode: "side", open: true, width: DEFAULT_WIDTH };
const listeners = new Set<() => void>();
let initialized = false;

function clampWidth(w: number): number {
  if (Number.isNaN(w)) return DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(w)));
}

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<DockState>;
      state = {
        mode: p.mode === "floating" || p.mode === "fullscreen" ? p.mode : "side",
        open: p.open !== false,
        width: clampWidth(typeof p.width === "number" ? p.width : DEFAULT_WIDTH),
      };
    }
  } catch {
    /* ignore */
  }
}

export function getDockState(): DockState {
  return state;
}

export function setDockState(patch: Partial<DockState>): void {
  state = {
    ...state,
    ...patch,
    width: patch.width !== undefined ? clampWidth(patch.width) : state.width,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((fn) => fn());
}

export function useDockState(): readonly [DockState, (patch: Partial<DockState>) => void] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    init();
    listeners.add(force);
    force();
    return () => {
      listeners.delete(force);
    };
  }, []);
  return [state, setDockState] as const;
}

/** True when the chat occupies horizontal space (side mode, open). */
export function dockReservesSpace(s: DockState): boolean {
  return s.mode === "side" && s.open;
}

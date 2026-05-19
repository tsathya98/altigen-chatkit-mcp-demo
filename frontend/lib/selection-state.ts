"use client";

/**
 * Which widget is currently selected on the canvas — drives the properties
 * panel + the focus ring on the canvas. Trivial module-level store.
 */

import { useEffect, useReducer } from "react";

let selectedId: string | null = null;
const listeners = new Set<() => void>();

export function selectWidget(id: string | null): void {
  if (selectedId === id) return;
  selectedId = id;
  listeners.forEach((fn) => fn());
}

export function getSelected(): string | null { return selectedId; }

export function useSelected(): string | null {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    force();
    return () => { listeners.delete(force); };
  }, []);
  return selectedId;
}

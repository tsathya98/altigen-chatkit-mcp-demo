"use client";

/**
 * Light/dark theme. Applied as data-theme attribute on <html>; CSS variables
 * in globals.css invert accordingly. Persisted to localStorage so the user's
 * choice survives reloads.
 */

import { useEffect, useReducer } from "react";

export type Theme = "light" | "dark";

const KEY = "altigen-theme";
let theme: Theme = "dark";
const listeners = new Set<() => void>();
let initialized = false;

function applyToDocument(t: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t;
}

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") {
      theme = stored;
    }
    // No system-preference fallback — dark is the intended default.
  } catch {
    /* ignore */
  }
  applyToDocument(theme);
}

export function getTheme(): Theme {
  return theme;
}

export function setTheme(t: Theme): void {
  theme = t;
  applyToDocument(t);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((fn) => fn());
}

export function toggleTheme(): void {
  setTheme(theme === "dark" ? "light" : "dark");
}

export function useTheme(): readonly [Theme, (t: Theme) => void] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    init();
    listeners.add(force);
    force();
    return () => {
      listeners.delete(force);
    };
  }, []);
  return [theme, setTheme] as const;
}

"use client";

const KEY = "altigen-auth";

export type Identity = { id: string; signedInAt: string };

export function signIn(id: string): Identity {
  const i = { id, signedInAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(i));
  return i;
}

export function signOut() { localStorage.removeItem(KEY); }

export function readIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

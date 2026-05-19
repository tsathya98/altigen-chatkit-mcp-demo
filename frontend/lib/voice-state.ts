"use client";

/**
 * Shared voice-session store. Subscribed by VoiceButton (in the header)
 * and VoiceOverlay (the Siri-style fullscreen modal). Module-level state
 * + listener set, same pattern as dock-state / sandbox-store.
 *
 * State machine (rough):
 *   idle  ─start()─►  connecting  ─SDP answer─►  listening
 *                                                    │
 *   listening ─user speaks (VAD)─►  user-speaking
 *                                       │
 *                       └─transcription.completed─►  thinking
 *                                                       │
 *                                  ◄─transcript deltas──┤
 *                                  ◄────── done ────────┤
 *                                  ─►  listening
 */

import { useEffect, useReducer } from "react";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "user-speaking"
  | "thinking"
  | "responding";

export type VoiceTurn = {
  id: string;
  startedAt: number;
  user: string;
  assistant: string;
  synced: boolean;   // whether we POSTed it to /api/voice/append-turn
};

export type VoiceState = {
  status: VoiceStatus;
  level: number;             // mic RMS, 0..1
  userPartial: string;       // user's currently-being-spoken question
  assistantPartial: string;  // agent's currently-being-spoken reply
  turns: VoiceTurn[];        // all completed turns this session
  threadId: string | null;   // active ChatKit thread (so we can sync)
  error: string | null;
};

const INITIAL: VoiceState = {
  status: "idle",
  level: 0,
  userPartial: "",
  assistantPartial: "",
  turns: [],
  threadId: null,
  error: null,
};

let state: VoiceState = { ...INITIAL };
const listeners = new Set<() => void>();

function emit() { listeners.forEach((fn) => fn()); }

export function getVoiceState(): VoiceState { return state; }

export function setVoiceState(patch: Partial<VoiceState>): void {
  state = { ...state, ...patch };
  emit();
}

export function resetVoice(): void {
  state = { ...INITIAL, threadId: state.threadId };
  emit();
}

export function setThreadId(id: string | null): void {
  if (state.threadId === id) return;
  state = { ...state, threadId: id };
  emit();
}

// ---------------------------------------------------------------------------
// Transcript stream helpers
// ---------------------------------------------------------------------------

export function appendUserPartial(t: string, replace = false): void {
  state = {
    ...state,
    status: "user-speaking",
    userPartial: replace ? t : state.userPartial + t,
  };
  emit();
}

export function finalizeUserTurn(text: string): void {
  // user finished — text replaces partial. Move to "thinking" until the
  // assistant starts streaming a reply.
  state = {
    ...state,
    status: "thinking",
    userPartial: text,
  };
  emit();
}

export function appendAssistantPartial(delta: string): void {
  state = {
    ...state,
    status: "responding",
    assistantPartial: state.assistantPartial + delta,
  };
  emit();
}

export function finalizeTurn(): VoiceTurn | null {
  const userText = state.userPartial.trim();
  const assistantText = state.assistantPartial.trim();
  if (!userText && !assistantText) return null;
  const turn: VoiceTurn = {
    id: "vt_" + Math.random().toString(36).slice(2, 10),
    startedAt: Date.now(),
    user: userText,
    assistant: assistantText,
    synced: false,
  };
  state = {
    ...state,
    status: "listening",
    userPartial: "",
    assistantPartial: "",
    turns: [...state.turns, turn],
  };
  emit();
  return turn;
}

export function markTurnSynced(id: string): void {
  state = {
    ...state,
    turns: state.turns.map((t) => (t.id === id ? { ...t, synced: true } : t)),
  };
  emit();
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bridge — the VoiceButton owns the WebRTC peer connection; the VoiceOverlay
// wants to "End" it without unmounting the button. The button registers
// its stop callback here on mount.
// ---------------------------------------------------------------------------

let stopHandler: (() => void) | null = null;

export function registerVoiceStop(fn: () => void): () => void {
  stopHandler = fn;
  return () => { if (stopHandler === fn) stopHandler = null; };
}

export function stopVoice(): void {
  if (stopHandler) stopHandler();
  else resetVoice();
}

export function useVoiceState(): VoiceState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    force();
    return () => { listeners.delete(force); };
  }, []);
  return state;
}

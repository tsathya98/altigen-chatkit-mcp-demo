"use client";

/**
 * Tiny pub-sub for "external code wants to talk to the chat dock".
 *
 * ChatDock registers a handler on mount (using ChatKit's `sendUserMessage`
 * / `setComposerValue` returned by useChatKit). The Command Palette,
 * quick-action buttons, etc. call into here without needing to know
 * anything about the dock or ChatKit internals.
 */

type Handler = {
  send: (text: string) => void;
  prefill: (text: string) => void;
  focus: () => void;
  open: () => void;
};

let handler: Handler | null = null;

export function registerChatBridge(h: Handler): () => void {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
}

export function chatSend(text: string): boolean {
  if (!handler) return false;
  try {
    handler.open();
    handler.send(text);
    return true;
  } catch {
    return false;
  }
}

export function chatPrefill(text: string): boolean {
  if (!handler) return false;
  try {
    handler.open();
    handler.prefill(text);
    handler.focus();
    return true;
  } catch {
    return false;
  }
}

export function chatFocus(): void {
  handler?.focus();
}

export function chatHasBridge(): boolean {
  return handler !== null;
}

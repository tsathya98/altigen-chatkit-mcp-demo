"use client";

import { usePathname } from "next/navigation";
import { stopVoice } from "@/lib/voice-state";
import { AgentActivity } from "./AgentActivity";
import { ChatDock } from "./ChatDock";
import { CommandPalette } from "./CommandPalette";
import { VoiceOverlay } from "./VoiceOverlay";

/**
 * Persistent app shell. Mounted once at the root layout, this keeps the
 * chat dock (and its live ChatKit + Realtime voice connection) alive across
 * route changes — without this, navigating from `/` to `/sandbox` would
 * unmount and remount the dock, orphaning any in-flight voice session.
 *
 * Hosts the Command Palette (⌘K), live Agent Activity panel, and the
 * Siri-style Voice Overlay so they're available everywhere except login.
 */
export function AppShell() {
  const pathname = usePathname() ?? "";
  if (pathname === "/login") return null;
  return (
    <>
      <ChatDock />
      <CommandPalette />
      <AgentActivity />
      <VoiceOverlay onClose={stopVoice} />
    </>
  );
}

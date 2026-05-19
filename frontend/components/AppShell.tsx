"use client";

import { usePathname } from "next/navigation";
import { AgentActivity } from "./AgentActivity";
import { ChatDock } from "./ChatDock";
import { CommandPalette } from "./CommandPalette";

/**
 * Persistent app shell. Mounted once at the root layout, this keeps the
 * chat dock (and its live ChatKit + Realtime voice connection) alive across
 * route changes — without this, navigating from `/` to `/sandbox` would
 * unmount and remount the dock, orphaning any in-flight voice session.
 *
 * Also hosts the Command Palette (⌘K) and the live Agent Activity panel,
 * so they're available everywhere except the login screen.
 */
export function AppShell() {
  const pathname = usePathname() ?? "";
  // Don't show on the login screen.
  if (pathname === "/login") return null;
  return (
    <>
      <ChatDock />
      <CommandPalette />
      <AgentActivity />
    </>
  );
}

"use client";

import { LogOut, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { StatusPill } from "./StatusPill";
import { UtcClock } from "./UtcClock";
import { signOut, type Identity } from "@/lib/auth";
import { useTheme } from "@/lib/theme-state";

export function DashboardHeader({
  identity,
  isFetching,
  refreshSec,
}: {
  identity: Identity | null;
  isFetching: boolean;
  refreshSec: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useTheme();
  const initials =
    identity?.id?.split("@")[0]?.slice(0, 2).toUpperCase() ?? "—";

  const navLink = (href: string, label: string) => {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        className={
          active
            ? "text-[var(--bone)]"
            : "text-[var(--muted)] hover:text-[var(--bone-soft)] transition-colors"
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="relative z-10">
      <div className="flex items-center justify-between gap-6 py-4 reveal">
        <div className="flex items-center gap-6">
          <Logo />
          <span className="hidden sm:inline-block h-6 w-px bg-[var(--line-hi)]" />
          <nav className="hidden sm:flex items-center gap-6 font-mono text-[11px] tracking-[0.18em] uppercase">
            {navLink("/", "Operations")}
            <span className="text-[var(--muted)] cursor-default">Trials</span>
            <span className="text-[var(--muted)] cursor-default">Quality</span>
            {navLink("/studio", "Studio")}
            {navLink("/sandbox", "Sandbox")}
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
              );
            }}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-hi)]/30 text-[var(--muted-hi)] hover:text-[var(--bone)] hover:border-[var(--bone-soft)] transition-colors cursor-pointer"
            title="Open command palette"
          >
            <Search size={13} />
            <span className="font-mono text-[11px] tracking-wider">Search KPIs, trials…</span>
            <span className="ml-3 font-mono text-[10px] text-[var(--muted)] tabular border border-[var(--line-hi)] rounded px-1.5">⌘K</span>
          </button>

          <StatusPill
            label={isFetching ? "Refreshing" : `Live · ${refreshSec}s`}
            tone="mint"
            pulsing={isFetching}
          />
          <UtcClock />

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="p-1.5 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)] transition-colors"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {identity && (
            <div className="flex items-center gap-2 pl-3 border-l border-[var(--line-hi)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bone)] text-[var(--ink)] font-mono text-[10.5px] tracking-wider">
                {initials}
              </span>
              <button
                onClick={() => { signOut(); router.replace("/login"); }}
                className="p-1.5 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)]"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="divider" />
    </header>
  );
}

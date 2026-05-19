"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetchKpis, fetchProducts, fetchTrials, type Kpi, type Product, type Trial } from "@/lib/api";
import { readIdentity, type Identity } from "@/lib/auth";
import { dockReservesSpace, useDockState } from "@/lib/dock-state";
import {
  clearSandbox,
  setSandboxMeta,
  useSandbox,
} from "@/lib/sandbox-store";
import { useTheme } from "@/lib/theme-state";
import { DashboardHeader } from "@/components/DashboardHeader";
import { NewWidgetMenu } from "@/components/sandbox/NewWidgetMenu";
import { WidgetRenderer } from "@/components/sandbox/WidgetRenderer";

const REFRESH_MS = 8_000;

export function SandboxClient() {
  const router = useRouter();
  const sandbox = useSandbox();
  const [dock] = useDockState();
  useTheme();

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const i = readIdentity();
    if (!i) { router.replace("/login"); return; }
    setIdentity(i);
    setAuthChecked(true);
  }, [router]);

  const products = useSWR<Product[]>(
    authChecked ? "products" : null,
    fetchProducts,
    { refreshInterval: REFRESH_MS },
  );
  const trials = useSWR<Trial[]>(
    authChecked ? "trials" : null,
    fetchTrials,
    { refreshInterval: REFRESH_MS },
  );
  const kpis = useSWR<Kpi[]>(
    authChecked ? "kpis" : null,
    () => fetchKpis(),
    { refreshInterval: REFRESH_MS },
  );

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(sandbox.title);
  useEffect(() => setTitleDraft(sandbox.title), [sandbox.title]);

  const isFetching = products.isValidating || trials.isValidating || kpis.isValidating;

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--ink-deep)]">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
          Verifying session…
        </span>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[var(--ink)]">
      {/* atmospheric */}
      <div className="fixed inset-0 pointer-events-none -z-0">
        <div className="absolute inset-0 grid-paper opacity-[0.05]" />
      </div>

      <ChatAwareContainer reserves={dockReservesSpace(dock)} width={dock.width}>
        <div className="px-6 lg:px-10 max-w-[1280px] mx-auto pb-20">
          <DashboardHeader
            identity={identity}
            isFetching={isFetching}
            refreshSec={REFRESH_MS / 1000}
          />

          {/* page title — click to rename, or call set_dashboard_meta from chat/voice */}
          <section className="pt-8 pb-4 reveal">
            <div className="kicker">
              {"[ SANDBOX · LIVE EDITOR ] "}
              <span className="mx-2 text-[var(--line-hi)]">/</span>
              {sandbox.widgets.length === 0 ? "empty" : `${sandbox.widgets.length} widget${sandbox.widgets.length === 1 ? "" : "s"}`}
            </div>

            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => { setSandboxMeta({ title: titleDraft }); setEditingTitle(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { setSandboxMeta({ title: titleDraft }); setEditingTitle(false); }
                  if (e.key === "Escape") { setTitleDraft(sandbox.title); setEditingTitle(false); }
                }}
                className="font-display text-[64px] sm:text-[84px] leading-[0.9] tracking-[-0.04em] mt-2 bg-transparent outline-none border-b border-[var(--mint)] w-full"
              />
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                className="font-display text-[64px] sm:text-[84px] leading-[0.9] tracking-[-0.04em] mt-2 text-[var(--bone)] cursor-text hover:opacity-90"
                title="Click to rename"
              >
                {sandbox.title}
              </h1>
            )}
            {sandbox.subtitle && (
              <p className="mt-4 max-w-[680px] text-[15px] text-[var(--bone-soft)] leading-snug">
                {sandbox.subtitle}
              </p>
            )}
          </section>

          {/* tooling row */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <NewWidgetMenu />
            <div className="flex-1" />
            {sandbox.widgets.length > 0 && (
              <button
                onClick={() => { if (confirm("Clear the sandbox dashboard?")) clearSandbox(); }}
                className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--muted-hi)] hover:text-[var(--coral)] px-3 py-1.5 border border-[var(--line-hi)] rounded-md transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* canvas */}
          {sandbox.widgets.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sandbox.widgets.map((w, i) => (
                <WidgetRenderer
                  key={w.id}
                  widget={w}
                  index={i}
                  total={sandbox.widgets.length}
                  products={products.data}
                  trials={trials.data}
                  kpis={kpis.data}
                />
              ))}
            </div>
          )}
        </div>
      </ChatAwareContainer>
      {/* Chat dock is mounted once at the root in app/layout.tsx via AppShell */}
    </main>
  );
}

function ChatAwareContainer({
  reserves, width, children,
}: Readonly<{ reserves: boolean; width: number; children: React.ReactNode }>) {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLg(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return (
    <div
      className="relative z-10 transition-[padding-right] duration-200"
      style={{ paddingRight: reserves && isLg ? `${width}px` : 0 }}
    >
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface-soft p-10 text-center reveal">
      <div className="kicker">[ NOTHING HERE YET ]</div>
      <h3 className="font-display text-[40px] mt-3 text-[var(--bone)]">
        A blank canvas.
      </h3>
      <p className="mt-3 max-w-[520px] mx-auto text-[14px] text-[var(--bone-soft)] leading-snug">
        Add widgets manually with the buttons above, or open the chat and ask the assistant —
        try voice mode and say{" "}
        <span className="font-mono text-[var(--mint)]">"build a dashboard tracking Adipara's launch"</span>.
      </p>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetchKpis, fetchProducts, fetchTrials, type Kpi, type Product, type Trial } from "@/lib/api";
import { readIdentity, type Identity } from "@/lib/auth";
import { dockReservesSpace, useDockState } from "@/lib/dock-state";
import { useTheme } from "@/lib/theme-state";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCards } from "./KpiCards";
import { ProductsTable } from "./ProductsTable";
import { TrendChart } from "./TrendChart";

const REFRESH_MS = 8_000;

export function DashboardClient() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const i = readIdentity();
    if (!i) { router.replace("/login"); return; }
    setIdentity(i);
    setAuthChecked(true);
  }, [router]);

  // gate everything until auth is confirmed
  const products = useSWR<Product[]>(
    authChecked ? "products" : null,
    fetchProducts, { refreshInterval: REFRESH_MS },
  );
  const trials = useSWR<Trial[]>(
    authChecked ? "trials" : null,
    fetchTrials, { refreshInterval: REFRESH_MS },
  );
  const kpis = useSWR<Kpi[]>(
    authChecked ? "kpis" : null,
    () => fetchKpis(), { refreshInterval: REFRESH_MS },
  );

  const [dock] = useDockState();
  useTheme(); // subscribe so the dashboard re-renders on theme change

  const [featured, setFeatured] = useState("Net product revenue (Zenoxitam)");
  const greeting = useGreeting();
  const currentKpis = (kpis.data ?? []).filter((k) => k.period === "2026-Q1");
  const distinctKpis = Array.from(new Set((kpis.data ?? []).map((k) => k.name)));
  const isLoading = !authChecked || products.isLoading || trials.isLoading || kpis.isLoading;
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
      {/* atmospheric layer */}
      <div className="fixed inset-0 pointer-events-none -z-0">
        <div className="absolute inset-0 grid-paper opacity-[0.07]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 75% -10%, rgba(122,243,208,0.05), transparent 65%), radial-gradient(70% 60% at -10% 100%, rgba(180,160,255,0.03), transparent 65%)",
          }}
        />
      </div>

      {/* Main content — reserves space for the docked chat rail on lg+ only
          when the chat actually takes horizontal space (side mode + open).
          Floating/fullscreen overlay; minimized chat gives back the room.
          The padding only applies on lg+ via media query in JS. */}
      <ChatAwareContainer reserves={dockReservesSpace(dock)} width={dock.width}>
        <div className="px-6 lg:px-10 max-w-[1280px] mx-auto pb-20">
          <DashboardHeader
            identity={identity}
            isFetching={isFetching}
            refreshSec={REFRESH_MS / 1000}
          />

          {/* page title */}
          <section className="pt-8 pb-6 reveal" style={{ animationDelay: "60ms" }}>
            <div className="kicker">
              {"[ 2026 · Q1 ] "}
              <span className="mx-2 text-[var(--line-hi)]">/</span>
              {" Operations Snapshot"}
            </div>
            <h1 className="font-display text-[64px] sm:text-[84px] leading-[0.9] tracking-[-0.04em] mt-2 text-[var(--bone)]">
              {`${greeting},`}
              <br />
              <span className="text-[var(--mint)]">{identity?.id?.split("@")[0] ?? "operator"}</span>
              {"."}
            </h1>
            <p className="mt-4 max-w-[560px] text-[15px] text-[var(--bone-soft)] leading-snug">
              {(products.data?.length ?? 0)} commercial & pipeline assets · {trials.data?.length ?? 0} trials in flight · {distinctKpis.length} KPIs tracked across functions.
              Ask the assistant anything you can't find on this page.
            </p>
          </section>

          <section className="flex flex-col gap-5 min-w-0">
            {isLoading ? <SkeletonGrid /> : <KpiCards kpis={currentKpis} />}

            {kpis.data && (
              <TrendChart
                kpis={kpis.data}
                kpiName={featured}
                options={distinctKpis}
                onKpiChange={setFeatured}
              />
            )}

            {products.data && <ProductsTable products={products.data} />}

            <div className="grid grid-cols-3 gap-4 reveal" style={{ animationDelay: "420ms" }}>
              <FactStat kicker="In flight" value={String(trials.data?.length ?? 0).padStart(2, "0")} label="Clinical trials" />
              <FactStat kicker="Recruiting" value={String(trials.data?.filter((t) => t.status === "Recruiting").length ?? 0).padStart(2, "0")} label="Trials open to enrollment" />
              <FactStat kicker="Phase III+" value={String(trials.data?.filter((t) => t.phase === "III" || t.phase === "IV").length ?? 0).padStart(2, "0")} label="Late-stage" />
            </div>

            {(products.error || trials.error || kpis.error) && (
              <div className="surface p-4 border-[var(--coral)]/40 text-[var(--coral)] font-mono text-[11.5px] tracking-wider uppercase">
                ▲ Backend not reachable on http://127.0.0.1:8000 — start the FastAPI server.
              </div>
            )}
          </section>
        </div>
      </ChatAwareContainer>
      {/* Chat dock is mounted once at the root in app/layout.tsx via AppShell */}
    </main>
  );
}

/** Wrapper that pads the right side equal to the chat-rail width on lg+ only,
 *  and zero otherwise. Watches the viewport so the value flips on resize. */
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

function useGreeting(): string {
  const [g, setG] = useState("Welcome back");
  useEffect(() => {
    const compute = () => {
      const h = new Date().getHours();
      if (h < 5)  return "Working late";
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      if (h < 21) return "Good evening";
      return "Working late";
    };
    setG(compute());
    const id = setInterval(() => setG(compute()), 60_000);
    return () => clearInterval(id);
  }, []);
  return g;
}

function FactStat({ kicker, value, label }: Readonly<{ kicker: string; value: string; label: string }>) {
  return (
    <div className="surface-soft p-5">
      <div className="kicker">{kicker}</div>
      <div className="hero-num text-[var(--bone)] mt-1">{value}</div>
      <div className="text-[12.5px] text-[var(--muted-hi)] mt-1.5">{label}</div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="surface-soft p-5 animate-pulse">
          <div className="h-3 w-24 bg-[var(--line-hi)] rounded" />
          <div className="mt-4 h-10 w-24 bg-[var(--line-hi)] rounded" />
          <div className="mt-3 h-3 w-32 bg-[var(--line-hi)] rounded" />
        </div>
      ))}
    </div>
  );
}

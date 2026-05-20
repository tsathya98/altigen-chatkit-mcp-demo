"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Moon, ShieldCheck, Sun } from "lucide-react";
import { signIn, readIdentity } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { UtcClock } from "@/components/UtcClock";
import { StatusPill } from "@/components/StatusPill";
import { useTheme } from "@/lib/theme-state";
import { MoleculeCanvas } from "./MoleculeCanvas";
import { CursorReadout } from "./CursorReadout";

const TICKER = [
  "BATCH ALT-ZNX-301",
  "PHASE III · COMPLETED",
  "RFT 96.7%",
  "ENROLLMENT 1187 / 1200",
  "PFS · BLINDED REVIEW",
  "ALT-ONK-301 · 42% TARGET",
  "Q1·2026",
  "PHARMACOVIGILANCE · 92.5%",
  "TIME-TO-MARKET 6.1Y",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("sathya@altigen.health");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    if (readIdentity()) router.replace("/");
  }, [router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setTimeout(() => {
      signIn(email);
      router.push("/");
    }, 520);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--ink-deep)]">
      {/* Layer 0 — molecular canvas (cursor reactive) */}
      <MoleculeCanvas />

      {/* Layer 1 — paper grid + grain + vignette */}
      <div className="fixed inset-0 -z-0 grid-paper opacity-[0.18] pointer-events-none" />
      <div className="fixed inset-0 -z-0 noise opacity-[0.6] pointer-events-none mix-blend-overlay" />
      <div
        className="fixed inset-0 -z-0 pointer-events-none login-radial"
      />

      {/* Top frame ----------------------------------------------------- */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 reveal">
        <Logo />
        <div className="flex items-center gap-6">
          <StatusPill label="System Online" tone="mint" />
          <UtcClock />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="p-1.5 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)] transition-colors"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* Center stage -------------------------------------------------- */}
      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-x-16 gap-y-10 items-center px-8 lg:px-14 pt-6 pb-28">
        {/* Left — editorial copy */}
        <div className="max-w-[640px]">
          <div className="kicker mb-6 reveal" style={{ animationDelay: "60ms" }}>
            <span className="kicker-mint">[ 2026 · Q1 ]</span>
            <span className="mx-3 text-[var(--line-hi)]">/</span>
            Operations Console · Build 23.04
          </div>

          <h1 className="font-display text-[120px] sm:text-[148px] leading-[0.86] tracking-[-0.04em] text-[var(--bone)] reveal-blur"
              style={{ animationDelay: "120ms" }}>
            Operations.
          </h1>
          <p className="mt-7 max-w-[440px] text-[17px] text-[var(--bone-soft)] leading-snug reveal"
             style={{ animationDelay: "260ms" }}>
            A clinical-grade dashboard for the people running pipeline,
            manufacturing, and pharmacovigilance for{" "}
            <em className="font-display not-italic">
              <span className="font-display">altigen pharma</span>
            </em>
            . Sign in to continue.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-x-10 gap-y-2 max-w-[520px] reveal"
               style={{ animationDelay: "360ms" }}>
            {[
              ["Products", "06"],
              ["Trials", "07"],
              ["KPIs tracked", "09"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="kicker">{k}</div>
                <div className="mt-1 font-display text-[40px] tabular leading-none text-[var(--bone)]">
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — sign in card */}
        <form
          onSubmit={submit}
          className="relative reveal"
          style={{ animationDelay: "420ms" }}
        >
          <div className="surface-soft p-7 sm:p-9 backdrop-blur-sm scanlines">
            <div className="flex items-center justify-between mb-7">
              <div className="kicker">[ Sign in ]</div>
              <span className="font-mono text-[10.5px] text-[var(--muted)]">
                ALT-001
              </span>
            </div>

            <label className="block">
              <span className="kicker">[ 01 ] Identifier</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@altigen.health"
                className="field mt-2"
                autoComplete="email"
                required
              />
            </label>

            <label className="block mt-7">
              <span className="kicker">[ 02 ] Passphrase</span>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="•••••••••••••"
                className="field mt-2"
                autoComplete="current-password"
              />
            </label>

            <div className="flex items-center justify-between mt-8">
              <label className="flex items-center gap-2 font-mono text-[11px] text-[var(--muted-hi)] tracking-wider uppercase">
                <input type="checkbox" defaultChecked className="accent-[var(--mint)] h-3 w-3" />
                Remember
              </label>
              <a href="#" className="font-mono text-[11px] text-[var(--muted-hi)] tracking-wider uppercase hover:text-[var(--bone)]">
                Need access?
              </a>
            </div>

            <button type="submit" disabled={busy} className="btn-mint w-full mt-7 justify-center">
              {busy ? "Authenticating…" : "Authenticate"}
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>

            <div className="mt-6 flex items-center gap-2 font-mono text-[10.5px] text-[var(--muted)] tracking-wider">
              <ShieldCheck size={12} />
              DEMO BUILD · ANY CREDENTIALS · NO DATA LEAVES THIS BROWSER
            </div>
          </div>

          {/* corner brackets */}
          {[
            "top-0 left-0 border-t border-l",
            "top-0 right-0 border-t border-r",
            "bottom-0 left-0 border-b border-l",
            "bottom-0 right-0 border-b border-r",
          ].map((cls, i) => (
            <span
              key={i}
              className={`absolute ${cls} h-3 w-3 border-[var(--mint)]/60 pointer-events-none`}
              style={{ margin: "-1px" }}
            />
          ))}
        </form>
      </section>

      {/* Bottom marquee ----------------------------------------------- */}
      <footer className="absolute bottom-0 inset-x-0 z-10 pb-5">
        <div className="divider mb-4" />
        <div className="flex items-center justify-between px-8">
          <CursorReadout />
          <div className="hidden md:block flex-1 mx-10 overflow-hidden mask-fade-x">
            <div className="ticker-track font-mono text-[10.5px] tracking-[0.2em] text-[var(--muted-hi)]">
              {[...TICKER, ...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="inline-flex items-center gap-3">
                  <span className="text-[var(--mint)]">▸</span>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <span className="font-mono text-[10.5px] tabular text-[var(--muted)] tracking-wider">
            v0.1.0 · think thursday
          </span>
        </div>
      </footer>

      <style jsx>{`
        .mask-fade-x {
          -webkit-mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
                  mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
        }
        /* Atmospheric radial — flips with theme so the colour wash registers
         * on both ink and bone backgrounds. */
        .login-radial {
          background:
            radial-gradient(60% 50% at 80% 20%, rgba(122,243,208,0.07), transparent 70%),
            radial-gradient(70% 60% at 10% 90%, rgba(180,160,255,0.05), transparent 70%);
        }
        :global(html[data-theme="light"]) .login-radial {
          background:
            radial-gradient(60% 50% at 80% 20%, rgba(13,122,96,0.10), transparent 70%),
            radial-gradient(70% 60% at 10% 90%, rgba(85,53,144,0.08), transparent 70%);
        }
      `}</style>
    </main>
  );
}

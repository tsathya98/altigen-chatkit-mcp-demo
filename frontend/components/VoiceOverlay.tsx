"use client";

/**
 * Siri-style fullscreen voice modal.
 *
 * Shown while the Realtime session is live. A big animated orb in the
 * middle pulses with mic input, status text below explains what the
 * agent is doing, transcripts stream in real time (user above, agent
 * below). Completed turns scroll into a history list.
 *
 * State is read from voice-state.ts — this component is purely visual.
 */

import { Mic, MicOff, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { useVoiceState, type VoiceStatus } from "@/lib/voice-state";

type Props = Readonly<{ onClose: () => void }>;

export function VoiceOverlay({ onClose }: Props) {
  const v = useVoiceState();
  const visible = v.status !== "idle";

  // ESC closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const statusLabel = STATUS_LABEL[v.status];

  // Orb scaling: baseline 1.0, breathes by ±0.06 plus mic level adds up to +0.18.
  const baseScale = 1 + (v.status === "responding" ? 0.06 : 0);
  const liveScale = baseScale + v.level * 0.18;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-[var(--ink-deep)]/85 backdrop-blur-2xl dock-pop"
    >
      {/* atmospheric */}
      <div className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute inset-0 grid-paper opacity-[0.04]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(40% 30% at 50% 35%, rgba(122,243,208,0.10), transparent 70%), radial-gradient(40% 30% at 50% 85%, rgba(255,122,92,0.04), transparent 70%)",
          }}
        />
      </div>

      {/* top bar */}
      <header className="relative z-10 w-full flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              v.status === "user-speaking"
                ? "bg-[var(--coral)] dot-breathe"
                : v.status === "responding" || v.status === "thinking"
                ? "bg-[var(--mint)] dot-breathe"
                : "bg-[var(--muted)]"
            }`}
          />
          <span className="kicker">[ Voice Mode · {statusLabel} ]</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--line-hi)] text-[var(--bone-soft)] hover:text-[var(--bone)] hover:border-[var(--bone-soft)] transition-colors"
          title="End voice session (Esc)"
        >
          <X size={13} />
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase">End</span>
        </button>
      </header>

      {/* central orb + live transcript */}
      <section className="relative z-10 flex-1 w-full max-w-[760px] mx-auto px-6 flex flex-col items-center justify-center">
        {/* current user partial — floats above the orb */}
        {v.userPartial && (
          <div className="mb-8 max-w-[640px] text-center">
            <div className="kicker mb-2">[ You ]</div>
            <p className="font-display text-[28px] sm:text-[34px] leading-[1.15] text-[var(--bone)]">
              {v.userPartial}
              {v.status === "user-speaking" && (
                <span className="inline-block w-[2px] h-[24px] bg-[var(--coral)] ml-1 align-middle animate-pulse" />
              )}
            </p>
          </div>
        )}

        {/* the orb */}
        <Orb scale={liveScale} status={v.status} />

        {/* current assistant partial — floats below */}
        {v.assistantPartial && (
          <div className="mt-8 max-w-[640px] text-center">
            <div className="kicker mb-2 kicker-mint">[ Altigen Ops ]</div>
            <p className="text-[15px] leading-relaxed text-[var(--bone-soft)] whitespace-pre-wrap">
              {v.assistantPartial}
            </p>
          </div>
        )}

        {/* when both partials are empty — a hint */}
        {!v.userPartial && !v.assistantPartial && (
          <p className="mt-8 max-w-[420px] text-center font-mono text-[12px] tracking-wider text-[var(--muted-hi)]">
            {v.status === "connecting"
              ? "Opening WebRTC stream to OpenAI Realtime…"
              : v.status === "listening"
              ? "Say something — “Show me Adipara revenue this quarter”."
              : "…"}
          </p>
        )}
      </section>

      {/* turn history */}
      <footer className="relative z-10 w-full max-w-[760px] mx-auto px-6 pb-6">
        {v.turns.length > 0 && (
          <div className="surface-soft p-3 max-h-[180px] overflow-y-auto">
            <div className="kicker mb-2">[ Turns this session · {v.turns.length} ]</div>
            <ul className="space-y-2">
              {v.turns.slice().reverse().map((t) => (
                <li key={t.id} className="text-[12px] leading-snug">
                  <div className="text-[var(--bone)] truncate">
                    <span className="text-[var(--muted-hi)] font-mono text-[10px] tracking-wider uppercase mr-1.5">YOU</span>
                    {t.user || <i className="text-[var(--muted)]">(no speech)</i>}
                  </div>
                  {t.assistant && (
                    <div className="text-[var(--bone-soft)] mt-0.5 line-clamp-2">
                      <span className="text-[var(--mint)] font-mono text-[10px] tracking-wider uppercase mr-1.5">OPS</span>
                      {t.assistant}
                    </div>
                  )}
                  {!t.synced && (
                    <span className="ml-[2.5rem] font-mono text-[9px] text-[var(--muted)] tracking-wider uppercase">
                      pending sync to chat
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-[var(--mint)]" />
            Turns mirror into the chat thread automatically
          </span>
          <span>ESC to end</span>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The orb — three concentric layers; the inner reacts to mic level.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle:            "idle",
  connecting:      "connecting",
  listening:       "listening",
  "user-speaking": "you’re speaking",
  thinking:        "thinking",
  responding:      "responding",
};

function Orb({
  scale, status,
}: Readonly<{ scale: number; status: VoiceStatus }>) {
  // Hex literals so we can append alpha (`#7af3d055`) — CSS vars don't compose
  // with hex alpha shortcuts the way string concatenation does.
  const hue = status === "user-speaking" ? "#ff7a5c" : "#7af3d0";
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 280, height: 280 }}
    >
      {/* halo */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${hue}AA 0%, transparent 65%)`,
          opacity: 0.6,
          filter: "blur(32px)",
          transform: `scale(${scale * 1.2})`,
          transition: "transform 90ms linear",
        }}
      />

      {/* outer ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 240,
          height: 240,
          border: `1px solid ${hue}`,
          opacity: 0.4,
          boxShadow: `0 0 60px ${hue}, inset 0 0 30px ${hue}`,
          transform: `scale(${0.92 + scale * 0.05})`,
          transition: "transform 120ms ease-out",
        }}
      />

      {/* mid ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 180,
          height: 180,
          background: `radial-gradient(circle at 30% 30%, ${hue}33, transparent 70%)`,
          border: `1px solid ${hue}66`,
          transform: `scale(${scale})`,
          transition: "transform 90ms ease-out",
        }}
      />

      {/* inner orb */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 100,
          height: 100,
          background: `radial-gradient(circle at 35% 35%, ${hue} 0%, ${hue}99 45%, ${hue}22 100%)`,
          boxShadow: `0 0 50px ${hue}77, inset 0 0 25px ${hue}AA`,
          transform: `scale(${0.98 + scale * 0.08})`,
          transition: "transform 60ms linear",
        }}
      >
        {status === "connecting" ? (
          <MicOff size={26} className="text-[var(--ink)] opacity-70" />
        ) : (
          <Mic size={26} className="text-[var(--ink)]" />
        )}
      </div>
    </div>
  );
}

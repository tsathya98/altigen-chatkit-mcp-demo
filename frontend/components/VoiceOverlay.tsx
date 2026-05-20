"use client";

/**
 * Liquid-glass voice dock — anchored middle-bottom of the screen so the
 * dashboard stays fully visible while a Realtime session is live.
 *
 * Inspired by visionOS / iOS "Liquid Glass": heavy backdrop blur, low-alpha
 * tinted surface, a soft top highlight + outer shadow that suggests a piece
 * of glass floating above the page. The orb is now a compact bloom of three
 * concentric blurs that pulses with the mic RMS; the live partial transcript
 * runs through the middle with status text above it.
 *
 * State is read from voice-state.ts — this component is purely visual.
 */

import { Mic, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useVoiceState, type VoiceStatus } from "@/lib/voice-state";

type Props = Readonly<{ onClose: () => void }>;

export function VoiceOverlay({ onClose }: Props) {
  const v = useVoiceState();
  const visible = v.status !== "idle";
  const [expanded, setExpanded] = useState(false);

  // ESC closes the session.
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
  const hue = v.status === "user-speaking" ? "var(--coral)" : "var(--mint)";

  // What text do we show in the live ticker line?  Prefer the partial that
  // is currently streaming; fall back to the most recent full one so the
  // dock never looks empty mid-session.
  const lastTurn = v.turns[v.turns.length - 1];
  const showUser = v.userPartial || (v.status === "user-speaking" && !v.assistantPartial);
  const tickerText = showUser
    ? v.userPartial || ""
    : v.assistantPartial || lastTurn?.assistant || lastTurn?.user || "";
  const tickerSpeaker: "user" | "agent" | null = showUser
    ? "user"
    : v.assistantPartial || lastTurn?.assistant
    ? "agent"
    : lastTurn
    ? "user"
    : null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Voice session dock"
      className="fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center pointer-events-none"
    >
      {/* Optional expanded turn history — slides up above the dock */}
      {expanded && v.turns.length > 0 && (
        <div className="pointer-events-auto mb-3 w-[min(720px,calc(100vw-32px))] glass-panel dock-pop">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="kicker">[ Turns this session · {v.turns.length} ]</span>
            <button
              onClick={() => setExpanded(false)}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted-hi)] hover:text-[var(--bone)] transition-colors"
            >
              hide
            </button>
          </div>
          <ul className="px-4 pb-3 space-y-2 max-h-[200px] overflow-y-auto">
            {v.turns.slice().reverse().map((t) => (
              <li key={t.id} className="text-[12px] leading-snug">
                <div className="text-[var(--bone)] truncate">
                  <span className="text-[var(--muted-hi)] font-mono text-[10px] tracking-wider uppercase mr-1.5">
                    you
                  </span>
                  {t.user || <i className="text-[var(--muted)]">(no speech)</i>}
                </div>
                {t.assistant && (
                  <div className="text-[var(--bone-soft)] mt-0.5 line-clamp-2">
                    <span className="kicker-mint font-mono text-[10px] tracking-wider uppercase mr-1.5">
                      ops
                    </span>
                    {t.assistant}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The glass dock itself */}
      <div
        className="pointer-events-auto glass-panel dock-pop relative flex items-center gap-3 px-3 py-2.5 w-[min(640px,calc(100vw-32px))]"
        style={{ borderRadius: 28 }}
      >
        {/* Left: compact orb / visualizer */}
        <MiniOrb level={v.level} status={v.status} hue={hue} />

        {/* Middle: status line + live transcript */}
        <div className="flex-1 min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                v.status === "user-speaking"
                  ? "bg-[var(--coral)] dot-breathe"
                  : v.status === "responding" || v.status === "thinking"
                  ? "bg-[var(--mint)] dot-breathe"
                  : "bg-[var(--muted)]"
              }`}
            />
            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-[var(--muted-hi)]">
              Voice · {statusLabel}
            </span>
          </div>
          <div className="text-[13px] text-[var(--bone)] truncate mt-0.5">
            {tickerText ? (
              <>
                {tickerSpeaker === "user" ? (
                  <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--coral)] mr-1.5">
                    you
                  </span>
                ) : (
                  <span className="font-mono text-[10px] tracking-wider uppercase kicker-mint mr-1.5">
                    ops
                  </span>
                )}
                {tickerText}
                {showUser && v.status === "user-speaking" && (
                  <span className="inline-block w-[2px] h-[12px] bg-[var(--coral)] ml-0.5 align-middle animate-pulse" />
                )}
              </>
            ) : (
              <span className="text-[var(--muted-hi)] italic font-display text-[14px]">
                {v.status === "connecting"
                  ? "Opening the stream…"
                  : v.status === "listening"
                  ? "Listening — say something."
                  : "…"}
              </span>
            )}
          </div>
        </div>

        {/* Right: turn count chip + end */}
        {v.turns.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-[var(--line-hi)] bg-[color-mix(in_oklab,var(--surface)_60%,transparent)] text-[var(--bone-soft)] hover:text-[var(--bone)] hover:border-[var(--bone-soft)] transition-colors font-mono text-[10px] tracking-wider uppercase"
            title="Toggle turn history"
          >
            <Sparkles size={11} className="text-[var(--mint)]" />
            {v.turns.length}
          </button>
        )}

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/30 text-[var(--coral)] hover:bg-[var(--coral)]/15 hover:border-[var(--coral)]/50 transition-colors font-mono text-[10px] tracking-[0.18em] uppercase"
          title="End voice session (Esc)"
        >
          <X size={12} strokeWidth={2.5} />
          End
        </button>
      </div>

      {/* Small "Esc to end" footnote */}
      <div className="mt-2 font-mono text-[9.5px] tracking-[0.2em] uppercase text-[var(--muted)] pointer-events-none">
        Voice turns mirror into chat · esc to end
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle:            "idle",
  connecting:      "connecting",
  listening:       "listening",
  "user-speaking": "you're speaking",
  thinking:        "thinking",
  responding:      "responding",
};

/**
 * Compact 44px orb — three layered radial bloomsthat pulse with the mic RMS.
 * Reads as a tiny glowing pearl tucked into the left of the glass dock.
 */
function MiniOrb({
  level, status, hue,
}: Readonly<{ level: number; status: VoiceStatus; hue: string }>) {
  const baseScale = 1 + (status === "responding" ? 0.05 : 0);
  const liveScale = baseScale + level * 0.25;
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      {/* halo */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${hue} 0%, transparent 65%)`,
          opacity: 0.45,
          filter: "blur(10px)",
          transform: `scale(${liveScale * 1.15})`,
          transition: "transform 90ms linear",
        }}
      />
      {/* mid ring */}
      <div
        className="absolute inset-[6px] rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, color-mix(in oklab, ${hue} 35%, transparent), transparent 70%)`,
          border: `1px solid color-mix(in oklab, ${hue} 40%, transparent)`,
          transform: `scale(${liveScale})`,
          transition: "transform 90ms ease-out",
        }}
      />
      {/* inner pearl */}
      <div
        className="absolute inset-[13px] rounded-full flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${hue} 0%, color-mix(in oklab, ${hue} 60%, transparent) 60%, transparent 100%)`,
          boxShadow: `0 0 18px color-mix(in oklab, ${hue} 50%, transparent), inset 0 0 8px color-mix(in oklab, ${hue} 70%, transparent)`,
          transform: `scale(${0.96 + level * 0.15})`,
          transition: "transform 60ms linear",
        }}
      >
        <Mic size={11} className="text-[var(--ink)]" strokeWidth={2.5} />
      </div>
    </div>
  );
}

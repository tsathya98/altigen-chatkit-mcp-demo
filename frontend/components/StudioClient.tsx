"use client";

import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { executeTool } from "@/lib/agent-tools";
import { readIdentity, type Identity } from "@/lib/auth";
import { closeCanvas, toggleCanvas, updateCanvas, useStudio } from "@/lib/studio-state";
import { useTheme } from "@/lib/theme-state";
import { setThreadId as setVoiceThreadId } from "@/lib/voice-state";
import { DashboardHeader } from "./DashboardHeader";
import { StudioCanvas } from "./StudioCanvas";

/**
 * Studio — chat-first surface with a poppable canvas on the right.
 *
 * Center chat is its own ChatKit instance (the global ChatDock is hidden
 * on this route so the chat lives inline). When the agent calls
 * `render_chart`, studio-state opens the right pane with the widget spec.
 * Resembles Claude/ChatGPT's canvas: chat on the left, artifact on the
 * right, both kept in view as the conversation continues.
 */
export function StudioClient() {
  const router = useRouter();
  const [theme] = useTheme();
  const studio = useStudio();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const i = readIdentity();
    if (!i) { router.replace("/login"); return; }
    setIdentity(i);
    setAuthChecked(true);
  }, [router]);

  const onClientTool = useCallback(
    async ({ name, params }: { name: string; params: Record<string, unknown> }) => {
      const result = await executeTool(name, params ?? {}, { router });
      try {
        const parsed = JSON.parse(result.output);
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
        return { ok: result.ok, value: parsed };
      } catch {
        return { ok: result.ok, output: result.output };
      }
    },
    [router],
  );

  const { control, sendUserMessage, setComposerValue, focusComposer } = useChatKit({
    api: {
      url: "/chatkit",
      domainKey:
        (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY) ||
        "altigen-local",
    },
    theme: {
      colorScheme: theme,
      radius: "soft",
      density: "compact",
      typography: {
        baseSize: 14,
        fontFamily: 'var(--font-sans), Geist, ui-sans-serif, system-ui, sans-serif',
        fontFamilyMono: 'var(--font-mono), "Geist Mono", ui-monospace, monospace',
      },
      color: {
        grayscale: { hue: 240, tint: theme === "light" ? 4 : 0 },
        accent: { primary: "#7af3d0", level: 2 },
      },
    },
    startScreen: {
      greeting:
        "Studio · ask anything, and I'll pop charts into the canvas as we go.",
      prompts: [
        { label: "Zenoxitam revenue trend", prompt: "Show me the trend of Zenoxitam net product revenue.", icon: "lucide:trending-up" },
        { label: "RFT vs target",           prompt: "How is batch right-first-time tracking vs target this quarter?", icon: "lucide:gauge" },
        { label: "Compare Q1 KPIs",         prompt: "Compare net product revenue across our top three products.", icon: "lucide:bar-chart-3" },
        { label: "Cardiology catalog",      prompt: "List our cardiology products.", icon: "lucide:heart-pulse" },
      ],
    },
    composer: {
      placeholder: "Ask for a chart, KPI, trend, comparison…",
      attachments: { enabled: false },
      dictation: { enabled: true },
    },
    history: { enabled: true, showDelete: true, showRename: true },
    threadItemActions: { feedback: true, retry: true },
    disclaimer: { text: "Demo build · mock pharma data · not for clinical use", highContrast: false },
    header: { enabled: false },
    onClientTool,
    onThreadChange: (e) => setVoiceThreadId(e.threadId),
  });

  // Suggest-a-chart chips while the canvas is empty — clicking sends the
  // prompt straight into the chat which triggers render_chart.
  const sendPrompt = (text: string) => {
    try { sendUserMessage({ text }); }
    catch { try { setComposerValue({ text }); focusComposer(); } catch { /* ignore */ } }
  };

  const canvasOpen = studio.open && studio.content;

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
        <div className="absolute inset-0 grid-paper opacity-[0.06]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 75% -10%, rgba(122,243,208,0.04), transparent 65%), radial-gradient(70% 60% at -10% 100%, rgba(180,160,255,0.03), transparent 65%)",
          }}
        />
      </div>

      <div className="relative z-10 px-6 lg:px-10 max-w-[1600px] mx-auto">
        <DashboardHeader identity={identity} isFetching={false} refreshSec={8} />
      </div>

      {/* Split view: chat (left) + canvas (right). The chat column flexes
          between full-width and ~half-width depending on canvas state. */}
      <div className="relative z-10 px-6 lg:px-10 max-w-[1600px] mx-auto pb-6">
        <div
          className="flex gap-5 items-stretch transition-[gap] duration-300"
          style={{ minHeight: "calc(100vh - 120px)" }}
        >
          {/* Chat column */}
          <div
            className={`flex flex-col min-w-0 transition-[flex-basis] duration-300 ${
              canvasOpen ? "basis-[42%]" : "basis-full"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="kicker">
                [ STUDIO ]
                <span className="mx-2 text-[var(--line-hi)]">/</span>
                Chat + canvas
              </div>
              {!canvasOpen && studio.content && (
                <button
                  onClick={() => toggleCanvas()}
                  className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--mint)] hover:text-[var(--bone)] flex items-center gap-1.5"
                  title="Reopen last canvas"
                >
                  <Sparkles size={12} />
                  Show canvas
                </button>
              )}
            </div>

            <div className="surface flex-1 min-h-0 overflow-hidden">
              <ChatKit control={control} className="h-full w-full" />
            </div>

            {/* When canvas is empty, show suggestion chips below the chat */}
            {!studio.content && (
              <div className="mt-4 reveal">
                <div className="kicker mb-2">[ Try asking ]</div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendPrompt(s)}
                      className="px-3 py-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-hi)]/40 text-[12.5px] text-[var(--bone-soft)] hover:text-[var(--bone)] hover:border-[var(--mint)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Canvas column — slides in when open. */}
          {canvasOpen && (
            <div className="basis-[58%] min-w-0 flex flex-col canvas-pop">
              <div className="mb-3 flex items-center justify-between">
                <div className="kicker flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--mint)] dot-breathe"
                        style={{ boxShadow: "0 0 10px var(--mint)" }} />
                  [ CANVAS ]
                  {studio.title && (
                    <>
                      <span className="mx-1 text-[var(--line-hi)]">/</span>
                      <span className="text-[var(--bone-soft)] truncate max-w-[280px]">{studio.title}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => closeCanvas()}
                  title="Close canvas"
                  className="p-1.5 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)] transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={14} />
                  <X size={13} />
                </button>
              </div>
              <div className="surface flex-1 min-h-0 overflow-hidden">
                {/* key on rev to remount on each new push so chart enter
                    animations replay */}
                <StudioCanvas key={studio.rev} title={studio.title} content={studio.content} />
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .canvas-pop {
          animation: canvas-slide 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes canvas-slide {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </main>
  );
}

const SUGGESTIONS = [
  "Show me Zenoxitam revenue over time",
  "Gauge for batch right-first-time",
  "Compare Q1 revenue across products",
  "Heatmap of function health",
  "List cardiology products",
  "Trials currently recruiting",
];

// Re-exported so other callers can imperatively push content into the
// canvas without importing studio-state (e.g. a future command-palette
// entry that wants to seed a canvas template).
export { updateCanvas };

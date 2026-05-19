"use client";

import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  GripVertical, History, Maximize2, MessageSquare, Minus, Moon, PanelRight, Plus, Sun, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { executeTool } from "@/lib/agent-tools";
import { registerChatBridge } from "@/lib/chat-bridge";
import { MAX_WIDTH, MIN_WIDTH, useDockState, type DockMode } from "@/lib/dock-state";
import { useTheme } from "@/lib/theme-state";
import { VoiceButton } from "./VoiceButton";

/**
 * The chat dock — *one* persistent ChatKit tree across all modes/sizes.
 * Modes (side / floating / fullscreen) and "open" only change wrapper
 * classes, never unmount the inner <ChatKit>, so the active session
 * survives every UI change. Side rail is user-resizable via the left edge.
 */
export function ChatDock() {
  const [dock, setDock] = useDockState();
  const [theme, setTheme] = useTheme();
  const router = useRouter();

  // ChatKit dispatches a single `onClientTool({name, params})` callback for
  // any client-side tool the agent invokes. We forward to the shared
  // executeTool which mutates the sandbox-store / routes the user.
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

  const { control, setThreadId, showHistory, focusComposer, sendUserMessage, setComposerValue } = useChatKit({
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
      greeting: "Ask anything about Altigen's pipeline, KPIs, or prescribing information.",
      prompts: [
        { label: "Q1 KPI snapshot", prompt: "Summarize how every Q1 KPI is tracking against target.", icon: "lucide:gauge" },
        { label: "RFT drivers",     prompt: "Why is batch right-first-time below target this quarter?", icon: "lucide:factory" },
        { label: "Zenoxitam label", prompt: "Walk me through Zenoxitam's prescribing info — indication, dosage, contraindications.", icon: "lucide:pill" },
        { label: "Cardiology",      prompt: "What products do we have in cardiology and how is each performing?", icon: "lucide:heart-pulse" },
      ],
    },
    composer: {
      placeholder: "Ask about KPIs, trials, or prescribing info…",
      attachments: { enabled: false },
      dictation: { enabled: true },
      tools: [
        { id: "catalog",   label: "Catalog",   shortLabel: "Cat",  icon: "lucide:flask-conical", placeholderOverride: "Search products and trials…" },
        { id: "kpis",      label: "KPIs",      shortLabel: "KPI",  icon: "lucide:gauge",          placeholderOverride: "Ask about a metric, period, or function…" },
        { id: "knowledge", label: "Knowledge", shortLabel: "Docs", icon: "lucide:book-open",      placeholderOverride: "Search prescribing info and operational briefs…" },
      ],
    },
    history: { enabled: true, showDelete: true, showRename: true },
    threadItemActions: { feedback: true, retry: true },
    disclaimer: { text: "Demo build · mock pharma data · not for clinical use", highContrast: false },
    header: { enabled: false },
    onClientTool,
  });

  const startNewThread = useCallback(() => {
    setThreadId(null);
    focusComposer();
  }, [setThreadId, focusComposer]);

  const setMode = (m: DockMode) => setDock({ mode: m, open: true });
  const minimize = () => setDock({ open: false });

  // ---- resize handle (side mode only) -----------------------------------

  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: dock.width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = dragRef.current.startX - ev.clientX;
      setDock({ width: dragRef.current.startW + dx });
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // double-click on handle resets width
  const resetWidth = () => setDock({ width: 420 });

  // keyboard shortcut: ⌘/Ctrl-J toggles open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setDock({ open: !dock.open });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dock.open, setDock]);

  // Expose chat actions to the rest of the app (CommandPalette, quick prompts).
  useEffect(() => {
    return registerChatBridge({
      open: () => setDock({ open: true }),
      focus: () => focusComposer(),
      prefill: (text: string) => { try { setComposerValue({ text }); } catch { /* ignore */ } },
      send: (text: string) => {
        try {
          sendUserMessage({ text });
        } catch {
          try { setComposerValue({ text }); focusComposer(); } catch { /* ignore */ }
        }
      },
    });
  }, [focusComposer, sendUserMessage, setComposerValue, setDock]);

  // ---- wrapper class per mode/state -------------------------------------

  const visible = dock.open;
  let wrapperCls = "flex flex-col overflow-hidden bg-[var(--ink-soft)] dock-pop";
  let wrapperStyle: React.CSSProperties = {};

  if (dock.mode === "side") {
    wrapperCls +=
      " hidden lg:flex fixed right-0 top-0 bottom-0 z-30 border-l border-[var(--line-hi)]";
    wrapperStyle = { width: `${dock.width}px` };
  } else if (dock.mode === "floating") {
    wrapperCls +=
      " fixed bottom-6 right-6 z-50 w-[400px] h-[600px] surface ring-mint";
  } else {
    // fullscreen
    wrapperCls += " fixed inset-4 sm:inset-8 z-50 surface";
  }

  if (!visible) wrapperCls += " hidden";

  // ---- header -----------------------------------------------------------

  const headerIconBtn =
    "p-1.5 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)] transition-colors";

  const header = (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)] bg-[var(--surface)]/60 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--mint)] dot-breathe"
              style={{ boxShadow: "0 0 10px var(--mint)" }} />
        <span className="kicker truncate">[ Ops Assistant ]</span>
      </div>
      <div className="flex items-center gap-0.5">
        <button onClick={startNewThread} title="New thread" className={headerIconBtn}>
          <Plus size={14} />
        </button>
        <button onClick={() => showHistory()} title="History" className={headerIconBtn}>
          <History size={14} />
        </button>
        <span className="mx-1 h-4 w-px bg-[var(--line-hi)]" />
        <VoiceButton />
        <span className="mx-1 h-4 w-px bg-[var(--line-hi)]" />
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className={headerIconBtn}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <span className="mx-1 h-4 w-px bg-[var(--line-hi)]" />
        <ModeToggle mode={dock.mode} setMode={setMode} />
        <button onClick={minimize} title="Minimize (⌘/Ctrl-J)" className={`ml-0.5 ${headerIconBtn}`}>
          {dock.mode === "fullscreen" ? <X size={14} /> : <Minus size={14} />}
        </button>
      </div>
    </div>
  );

  // ---- resize handle ----------------------------------------------------

  const resizeHandle = dock.mode === "side" && (
    <div
      onMouseDown={onResizeStart}
      onDoubleClick={resetWidth}
      title="Drag to resize · double-click to reset"
      className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--mint)]/20 group z-10"
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={12} className="text-[var(--mint)]" />
      </div>
    </div>
  );

  return (
    <>
      {/* The chat surface — one tree, kept mounted forever. */}
      <div className={wrapperCls} style={wrapperStyle}>
        {resizeHandle}
        {header}
        <div className="flex-1 min-h-0">
          <ChatKit control={control} className="h-full w-full" />
        </div>
      </div>

      {/* Backdrop for fullscreen */}
      {dock.mode === "fullscreen" && visible && (
        <div className="fixed inset-0 z-40 bg-[var(--ink-deep)]/85 backdrop-blur-md" />
      )}

      {/* Launcher — visible whenever the chat is hidden (mobile or minimized) */}
      <button
        onClick={() => setDock({ open: true })}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-[var(--bone)] text-[var(--ink)] shadow-[0_18px_60px_-12px_rgba(122,243,208,0.45)] dock-pop ${
          visible ? "lg:hidden" : ""
        } ${visible && dock.mode === "side" ? "" : ""}`}
        style={visible && dock.mode === "side" ? undefined : visible ? { display: "none" } : undefined}
        hidden={visible && dock.mode !== "side"}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-[var(--mint)] dot-breathe"
              style={{ boxShadow: "0 0 12px var(--mint)" }} />
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase">Ask Ops</span>
        <MessageSquare size={14} />
      </button>
    </>
  );
}

function ModeToggle({
  mode,
  setMode,
}: Readonly<{ mode: DockMode; setMode: (m: DockMode) => void }>) {
  const modes: { id: DockMode; icon: React.ReactNode; label: string }[] = [
    { id: "floating",   icon: <MessageSquare size={13} />, label: "Floating" },
    { id: "side",       icon: <PanelRight size={13} />,    label: "Side" },
    { id: "fullscreen", icon: <Maximize2 size={13} />,     label: "Full" },
  ];
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md border border-[var(--line)] bg-[var(--surface-hi)]/40">
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            title={m.label}
            className={`flex items-center justify-center h-6 w-7 rounded transition-colors ${
              active
                ? "bg-[var(--bone)] text-[var(--ink)]"
                : "text-[var(--muted-hi)] hover:text-[var(--bone)]"
            }`}
          >
            {m.icon}
          </button>
        );
      })}
    </div>
  );
}

export { MIN_WIDTH, MAX_WIDTH };

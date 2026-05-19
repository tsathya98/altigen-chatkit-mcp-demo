"use client";

import { Mic, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { pushClientActivity } from "@/lib/activity-store";
import { executeTool, toolsForRealtime } from "@/lib/agent-tools";
import {
  appendAssistantPartial,
  finalizeTurn,
  finalizeUserTurn,
  getVoiceState,
  markTurnSynced,
  registerVoiceStop,
  resetVoice,
  setVoiceState,
  useVoiceState,
  type VoiceTurn,
} from "@/lib/voice-state";

/**
 * Realtime voice mode — WebRTC straight to OpenAI's GA Realtime API.
 *
 * Drives the shared voice-state store so the VoiceOverlay can render
 * a Siri-style modal alongside this header pill. Captures transcripts
 * from the Realtime data channel and POSTs each completed turn to
 * /api/voice/append-turn so the conversation mirrors into the ChatKit
 * thread — exactly like ChatGPT's voice mode shows the spoken turns
 * as text once you leave the call.
 */

const REALTIME_INSTRUCTIONS = `
You are the Altigen Pharma operations assistant, in voice mode. The user is on
stage demonstrating the system. Keep replies short — one or two sentences,
spoken naturally.

You can MUTATE the UI by calling tools:
  • navigate({path}) — '/' for the operations snapshot, '/sandbox' for the
    custom dashboard editor.
  • create_dashboard({title, subtitle?, widgets[]}) — wholesale-replace the
    sandbox dashboard. Widget kinds:
      - {kind:"kpi", kpiName, period?}                — large headline
      - {kind:"gauge", kpiName, period?}              — vs target gauge
      - {kind:"sparkline", kpiName}                   — compact mini chart
      - {kind:"trend", kpiName}                       — full area chart
      - {kind:"heatmap", function_?}                  — overall health grid
      - {kind:"compare", kpiNames[2-4], period?}      — side-by-side bars
      - {kind:"products", therapyArea?}
      - {kind:"trials", productName?, phase?, status?}
      - {kind:"note", markdown}
    Pick 3 to 6 widgets that cover the topic well. Mix shapes (a gauge plus a
    trend plus a heatmap reads better than three KPI cards). Common KPI names:
      "Net product revenue (Zenoxitam)", "Net product revenue (Adipara)",
      "Batch right-first-time", "On-time trial enrollment",
      "Adverse-event reporting SLA", "Site activation cycle time".
  • add_widget / remove_widget / update_widget / set_dashboard_meta /
    clear_dashboard — for incremental edits.
  • set_filters({period?, therapyArea?, function?}) — global slicers; every
    widget without its own value inherits from these.
  • new_dashboard / switch_dashboard / rename_dashboard / duplicate_dashboard /
    delete_dashboard — managing the saved dashboard list (left sidebar).

  Widgets can take an optional pos:{x,y,w,h} on a 12-col grid; omit to
  auto-place.

When the user asks for a dashboard about a topic, FIRST navigate to /sandbox
then call create_dashboard. Speak briefly while you build ("Building a launch
tracker for Adipara — one moment.") then confirm when done.

About Altigen: 22 products across cardiology, neurology, oncology, immunology,
metabolic, and rare disease, led by Zenoxitam (HFrEF) and Adipara (obesity).
Q1 2026 KPIs are mostly improving — Adipara revenue is on plan,
right-first-time is at 96.7% (target 98%), and ALT-ONK-301 enrollment is
behind plan due to Japan/Brazil site activation delays.
`.trim();

export function VoiceButton() {
  const router = useRouter();
  const voice = useVoiceState();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const live = voice.status !== "idle" && voice.status !== "connecting";
  const connecting = voice.status === "connecting";

  // Expose stop() to the overlay's "End" button.
  useEffect(() => {
    return registerVoiceStop(stop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mic level → voice-state.level, drives both header pill and overlay orb.
  useEffect(() => {
    if (voice.status === "idle" || !acRef.current) return;
    const analyser = (acRef.current as any).__analyser as AnalyserNode | undefined;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      setVoiceState({ level: Math.min(1, rms * 3) });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [voice.status]);

  async function start() {
    try {
      setVoiceState({ status: "connecting", error: null });

      // 1. Mint ephemeral session token from our backend.
      const tokenRes = await fetch("/api/voice/realtime-token", { method: "POST" });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
      const session = await tokenRes.json();
      const ephemeralKey: string | undefined =
        session?.value ??
        session?.client_secret?.value ??
        session?.client_secret;
      if (!ephemeralKey) throw new Error("no ephemeral key in session response");

      // 2. Peer connection + remote audio playback.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

      // 3. User mic.
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      ms.getTracks().forEach((t) => pc.addTrack(t, ms));

      // AnalyserNode for the live mic-level signal.
      try {
        const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ac.createMediaStreamSource(ms);
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        (ac as any).__analyser = an;
        acRef.current = ac;
      } catch { /* best effort */ }

      // 4. Data channel.
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: REALTIME_INSTRUCTIONS,
            audio: {
              input: { transcription: { model: "gpt-4o-transcribe" } },
              output: { voice: "marin" },
            },
            tools: toolsForRealtime(),
            tool_choice: "auto",
          },
        }));
      });

      dc.addEventListener("message", async (msg) => {
        let evt: any;
        try { evt = JSON.parse(msg.data); } catch { return; }
        if (!evt?.type) return;

        // ---- VAD signals --------------------------------------------------
        if (evt.type === "input_audio_buffer.speech_started") {
          setVoiceState({ status: "user-speaking", userPartial: "" });
          return;
        }
        if (evt.type === "input_audio_buffer.speech_stopped") {
          setVoiceState({ status: "thinking" });
          return;
        }

        // ---- User-speech transcription (final) ---------------------------
        // GA: conversation.item.input_audio_transcription.completed
        if (
          evt.type === "conversation.item.input_audio_transcription.completed" ||
          evt.type === "conversation.item.input_audio_transcription.done"
        ) {
          const text: string = evt.transcript ?? "";
          if (text) finalizeUserTurn(text);
          return;
        }

        // ---- Assistant audio transcript streaming ------------------------
        // GA: response.output_audio_transcript.delta / .done
        if (
          evt.type === "response.output_audio_transcript.delta" ||
          evt.type === "response.audio_transcript.delta"
        ) {
          const delta: string = evt.delta ?? "";
          if (delta) appendAssistantPartial(delta);
          return;
        }
        if (
          evt.type === "response.output_audio_transcript.done" ||
          evt.type === "response.audio_transcript.done"
        ) {
          // Turn is over — finalize and POST it to the chat thread.
          const turn = finalizeTurn();
          if (turn) await syncTurn(turn);
          return;
        }

        // ---- Tool calls (existing behaviour, unchanged) ------------------
        if (
          evt.type === "response.output_item.done" &&
          evt.item?.type === "function_call"
        ) {
          const { name, call_id, arguments: rawArgs } = evt.item;
          const result = await executeTool(name, rawArgs ?? "{}", { router });
          dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id, output: result.output },
          }));
          dc.send(JSON.stringify({ type: "response.create" }));
        }
      });

      // 5. SDP offer → POST to /v1/realtime/calls.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const model = session?.model ?? "gpt-realtime";
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpRes.ok) throw new Error(`sdp ${sdpRes.status}`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

      setVoiceState({ status: "listening" });
      pushClientActivity({ kind: "info", name: "voice_session", text: "Voice mode connected" });
    } catch (err) {
      console.error("[voice]", err);
      setVoiceState({ status: "idle", error: String(err) });
      stop();
    }
  }

  function stop() {
    try { dcRef.current?.close(); } catch { /* ignore */ }
    try { pcRef.current?.close(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    try { acRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    streamRef.current = null;
    dcRef.current = null;
    audioRef.current = null;
    acRef.current = null;
    resetVoice();
  }

  const label = connecting ? "Connecting" : live ? "Listening" : "Voice";

  return (
    <button
      onClick={live || connecting ? stop : start}
      className={`relative flex items-center gap-1.5 text-[10.5px] font-mono tracking-[0.18em] uppercase rounded-full px-2.5 py-1 border transition-colors ${
        live
          ? "border-[var(--coral)]/50 text-[var(--coral)] bg-[var(--coral)]/10"
          : connecting
          ? "border-[var(--line-hi)] text-[var(--muted-hi)]"
          : "border-[var(--line-hi)] text-[var(--muted-hi)] hover:text-[var(--bone)] hover:border-[var(--bone-soft)]"
      }`}
      title={live ? "Stop voice mode" : "Start voice mode"}
    >
      {live ? <Square size={11} /> : <Mic size={11} />}
      {live ? <WaveBars level={voice.level} /> : <span>{label}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

async function syncTurn(turn: VoiceTurn): Promise<void> {
  const threadId = getVoiceState().threadId;
  try {
    const res = await fetch("/api/voice/append-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: threadId,
        user_text: turn.user,
        assistant_text: turn.assistant,
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      // If the backend created a new thread for us, remember it.
      const newThreadId: string | undefined = data?.thread_id;
      if (newThreadId && newThreadId !== threadId) {
        setVoiceState({ threadId: newThreadId });
      }
      markTurnSynced(turn.id);
      pushClientActivity({
        kind: "info",
        name: "voice_turn_synced",
        text: `Mirrored voice turn → chat (${turn.user.slice(0, 60)})`,
      });
    }
  } catch (err) {
    console.warn("[voice] append-turn failed", err);
  }
}

/** Five reactive bars next to the Stop icon — height tracks mic RMS. */
function WaveBars({ level }: Readonly<{ level: number }>) {
  const base = 0.25 + level * 0.85;
  const bars = [base, base * 1.2, base * 0.8, base * 1.4, base * 0.6];
  return (
    <span className="flex items-end gap-[2px] h-[12px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="block w-[2px] rounded-[1px] bg-[var(--coral)]"
          style={{
            height: `${Math.min(100, h * 100)}%`,
            transition: "height 80ms linear",
          }}
        />
      ))}
    </span>
  );
}

"use client";

import { Mic, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { executeTool, toolsForRealtime } from "@/lib/agent-tools";
import { pushClientActivity } from "@/lib/activity-store";

/**
 * Realtime voice mode — WebRTC straight to OpenAI's GA Realtime API.
 *
 * Flow (2026):
 *   1. Backend mints an ephemeral key via POST /v1/realtime/client_secrets.
 *   2. Browser opens an RTCPeerConnection, attaches mic, opens a data channel.
 *   3. Browser POSTs the SDP offer to https://api.openai.com/v1/realtime/calls
 *      with `Authorization: Bearer <ephemeral key>` and Content-Type: application/sdp.
 *   4. Once connected, sends `session.update` over the data channel with the
 *      Altigen Pharma system instructions so the voice agent answers in context.
 *
 * The user's mic stream never touches our backend — only the ephemeral key is
 * proxied. This is the official supported pattern.
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
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [level, setLevel] = useState(0);   // 0-1, mic loudness for waveform
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  // Start polling the analyser whenever `live` flips on.
  useEffect(() => {
    if (!live || !acRef.current) return;
    const ac = acRef.current;
    const analyser = (ac as any).__analyser as AnalyserNode | undefined;
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
      setLevel(Math.min(1, rms * 3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [live]);

  async function start() {
    try {
      setConnecting(true);

      // 1. Mint ephemeral session token from our backend.
      const tokenRes = await fetch("/api/voice/realtime-token", { method: "POST" });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
      const session = await tokenRes.json();
      const ephemeralKey: string | undefined =
        session?.value ??                     // GA shape
        session?.client_secret?.value ??      // legacy fallback
        session?.client_secret;
      if (!ephemeralKey) throw new Error("no ephemeral key in session response");

      // 2. Set up the peer connection + remote-audio playback.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

      // 3. Add the user's mic.
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      ms.getTracks().forEach((t) => pc.addTrack(t, ms));

      // Attach an AnalyserNode so we can draw a live waveform indicator.
      try {
        const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ac.createMediaStreamSource(ms);
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        (ac as any).__analyser = an;
        acRef.current = ac;
      } catch {
        /* audio analysis is best-effort */
      }

      // 4. Open a data channel for control messages + tool-call routing.
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("open", () => {
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: REALTIME_INSTRUCTIONS,
            audio: { output: { voice: "marin" } },
            tools: toolsForRealtime(),
            tool_choice: "auto",
          },
        }));
      });

      // Tool-call dispatch: the model emits a function_call item we execute
      // locally (mutating the sandbox / routing) and reply with the output.
      dc.addEventListener("message", async (msg) => {
        let evt: any;
        try { evt = JSON.parse(msg.data); } catch { return; }
        if (!evt?.type) return;

        // GA event for a completed function call.
        if (evt.type === "response.output_item.done" && evt.item?.type === "function_call") {
          const { name, call_id, arguments: rawArgs } = evt.item;
          const result = await executeTool(name, rawArgs ?? "{}", { router });
          dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id,
              output: result.output,
            },
          }));
          dc.send(JSON.stringify({ type: "response.create" }));
        }
      });

      // 5. SDP offer → POST to /v1/realtime/calls (GA endpoint).
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

      setLive(true);
      pushClientActivity({ kind: "info", name: "voice_session", text: "Voice mode connected" });
    } catch (err) {
      console.error("[voice]", err);
      stop();
      alert("Voice mode failed to start. Check the console for details.");
    } finally {
      setConnecting(false);
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
    setLive(false);
    setLevel(0);
  }

  const label = connecting ? "Connecting" : live ? "Listening" : "Voice";

  return (
    <button
      onClick={live ? stop : start}
      disabled={connecting}
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
      {live ? <WaveBars level={level} /> : <span>{label}</span>}
      {!live && connecting && <span className="ml-1 voice-bar" style={{ color: "var(--muted)" }} />}
    </button>
  );
}

/** Five reactive bars next to the Stop icon — height tracks mic RMS. */
function WaveBars({ level }: Readonly<{ level: number }>) {
  // Five bars; each gets a slightly different envelope so they don't all
  // pulse identically. We add a baseline so quiet rooms still show motion.
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

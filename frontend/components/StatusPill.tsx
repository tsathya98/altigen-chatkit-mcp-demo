type Tone = "mint" | "muted" | "coral";

export function StatusPill({
  label,
  tone = "mint",
  pulsing = true,
}: {
  label: string;
  tone?: Tone;
  pulsing?: boolean;
}) {
  const color =
    tone === "coral" ? "var(--coral)" :
    tone === "muted" ? "var(--muted-hi)" : "var(--mint)";

  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--muted-hi)]">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${pulsing ? "dot-breathe" : ""}`}
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      />
      {label}
    </span>
  );
}

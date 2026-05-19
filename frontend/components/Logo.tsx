export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        {/* tri-node molecule mark */}
        <circle cx="16" cy="6"  r="2.4" fill="var(--mint)" />
        <circle cx="6"  cy="22" r="2.4" stroke="var(--bone)" strokeWidth="1.2" />
        <circle cx="26" cy="22" r="2.4" stroke="var(--bone)" strokeWidth="1.2" />
        <path d="M16 8.4 L7.2 20.4 M16 8.4 L24.8 20.4 M8.2 22 L23.8 22"
              stroke="var(--bone)" strokeWidth="0.8" strokeOpacity="0.7" />
      </svg>
      <span className="font-display text-[22px] leading-none -mb-0.5">altigen</span>
    </span>
  );
}

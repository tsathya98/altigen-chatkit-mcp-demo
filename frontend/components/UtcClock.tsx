"use client";

import { useEffect, useState } from "react";

function fmt(d: Date) {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function UtcClock() {
  const [t, setT] = useState<string>("");
  useEffect(() => {
    const tick = () => setT(fmt(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-[11px] tabular text-[var(--muted-hi)]">
      {t || "00:00:00"} <span className="text-[var(--muted)]">UTC</span>
    </span>
  );
}

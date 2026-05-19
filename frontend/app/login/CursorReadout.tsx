"use client";

import { useEffect, useState } from "react";

/** Bottom-corner mouse coords readout — instrumentation feel. */
export function CursorReadout() {
  const [pos, setPos] = useState({ x: 0, y: 0, vw: 1, vh: 1 });
  useEffect(() => {
    const onMove = (e: MouseEvent) =>
      setPos({ x: e.clientX, y: e.clientY, vw: window.innerWidth, vh: window.innerHeight });
    const onResize = () =>
      setPos((p) => ({ ...p, vw: window.innerWidth, vh: window.innerHeight }));
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  const fx = (pos.x / pos.vw).toFixed(3);
  const fy = (pos.y / pos.vh).toFixed(3);
  return (
    <span className="font-mono text-[10.5px] tabular text-[var(--muted)] tracking-wider">
      X<span className="text-[var(--bone-soft)] ml-1.5">{fx}</span>
      <span className="mx-3 text-[var(--line-hi)]">/</span>
      Y<span className="text-[var(--bone-soft)] ml-1.5">{fy}</span>
    </span>
  );
}

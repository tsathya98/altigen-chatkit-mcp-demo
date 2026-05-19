"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor-reactive particle field. Particles drift slowly through a dark
 * "buffer", connect with thin lines when they're near each other, and
 * brighten as the cursor approaches — a microscope-and-molecule feel.
 *
 * Pure canvas. No deps. ~60 lines of actual logic.
 */
export function MoleculeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const mouse = { x: -9999, y: -9999, on: false };
    const target = { x: -9999, y: -9999 };

    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let particles: P[] = [];

    const init = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.scale(dpr, dpr);
      const count = Math.min(72, Math.floor((w * h) / 22000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() < 0.15 ? 1.6 : 1.0,
      }));
    };

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      mouse.on = true;
    };
    const onLeave = () => { mouse.on = false; target.x = -9999; target.y = -9999; };
    const onResize = () => init();

    init();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // smooth cursor follow
      mouse.x += (target.x - mouse.x) * 0.12;
      mouse.y += (target.y - mouse.y) * 0.12;

      // connection radius
      const R = 150;
      const Rsq = R * R;
      const Rcursor = 220;
      const RcursorSq = Rcursor * Rcursor;

      // particle update + draw
      for (const p of particles) {
        // mild attraction toward cursor when near
        if (mouse.on) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dsq = dx * dx + dy * dy;
          if (dsq < RcursorSq) {
            const f = (1 - dsq / RcursorSq) * 0.04;
            p.vx += (dx / Math.sqrt(dsq + 0.01)) * f;
            p.vy += (dy / Math.sqrt(dsq + 0.01)) * f;
          }
        }
        // damping
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        // wrap
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // proximity to cursor controls brightness
        const dxC = mouse.x - p.x;
        const dyC = mouse.y - p.y;
        const dC = Math.sqrt(dxC * dxC + dyC * dyC);
        const t = Math.max(0, 1 - dC / Rcursor);

        // dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + t * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244, 239, 230, ${0.16 + t * 0.7})`;
        ctx.fill();
      }

      // particle-to-particle lines
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dsq = dx * dx + dy * dy;
          if (dsq < Rsq) {
            const alpha = (1 - dsq / Rsq) * 0.18;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(244, 239, 230, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // cursor-to-particle lines (mint accent)
      if (mouse.on) {
        for (const p of particles) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dsq = dx * dx + dy * dy;
          if (dsq < RcursorSq) {
            const alpha = (1 - dsq / RcursorSq) * 0.55;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = `rgba(122, 243, 208, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
        // cursor halo
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, Rcursor);
        grad.addColorStop(0, "rgba(122,243,208,0.10)");
        grad.addColorStop(1, "rgba(122,243,208,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-0 pointer-events-none"
      aria-hidden
    />
  );
}

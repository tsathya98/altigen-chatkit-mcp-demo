"use client";

/**
 * Free-form grid canvas — Power BI-style.
 *
 * Widgets live at absolute positions defined by `pos: { x, y, w, h }` in
 * grid cells. Pointer-down on the widget body drags it; pointer-down on
 * a corner handle resizes it. Everything snaps to the grid.
 *
 * The canvas height auto-grows to fit the lowest widget.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLS,
  GAP_PX,
  MIN_H,
  MIN_W,
  ROW_PX,
  moveWidgetTo,
  type Widget,
} from "@/lib/sandbox-store";
import { selectWidget, useSelected } from "@/lib/selection-state";
import type { Kpi, Product, Trial } from "@/lib/api";
import { WidgetRenderer } from "./WidgetRenderer";

type Props = Readonly<{
  widgets: Widget[];
  products?: Product[];
  trials?: Trial[];
  kpis?: Kpi[];
  filters: { period?: string; therapyArea?: string; function?: string };
}>;

export function Canvas({ widgets, products, trials, kpis, filters }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [cellW, setCellW] = useState(80);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const selected = useSelected();

  // Measure column width to convert pixel deltas → grid units.
  useEffect(() => {
    if (!ref.current) return;
    const measure = () => {
      const w = (ref.current?.clientWidth ?? 0);
      const avail = w - GAP_PX * (COLS + 1);
      setCellW(Math.max(40, Math.floor(avail / COLS)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Drag/resize pointer handling — global move + up so the gesture keeps
  // tracking even if the pointer leaves the widget.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dxCells = pxToCells(e.clientX - drag.startX, cellW);
      const dyCells = pxToRows(e.clientY - drag.startY);
      let next = { ...drag.original };
      if (drag.mode === "move") {
        next.x = drag.original.x + dxCells;
        next.y = drag.original.y + dyCells;
      } else if (drag.mode === "resize-se") {
        next.w = drag.original.w + dxCells;
        next.h = drag.original.h + dyCells;
      } else if (drag.mode === "resize-e") {
        next.w = drag.original.w + dxCells;
      } else if (drag.mode === "resize-s") {
        next.h = drag.original.h + dyCells;
      }
      // Clamp + snap
      next.x = clamp(next.x, 0, COLS - 1);
      next.y = Math.max(0, next.y);
      next.w = clamp(next.w, MIN_W, COLS);
      next.h = Math.max(MIN_H, next.h);
      if (next.x + next.w > COLS) next.x = COLS - next.w;
      // Live update during drag (cheap because store is synchronous).
      moveWidgetTo(drag.id, next);
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, cellW]);

  const onWidgetDown = useCallback(
    (e: React.PointerEvent, w: Widget, mode: DragMode) => {
      // Ignore clicks that came from interactive children (buttons, inputs).
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, textarea, [data-no-drag]")) return;
      if (mode === "move" && target.closest("[data-resize-handle]")) return;

      e.preventDefault();
      selectWidget(w.id);
      setDrag({
        id: w.id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        original: { ...w.pos },
      });
    },
    [],
  );

  const totalRows = Math.max(8, ...widgets.map((w) => w.pos.y + w.pos.h));
  const canvasHeight = totalRows * ROW_PX + (totalRows + 1) * GAP_PX;

  return (
    <div
      ref={ref}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectWidget(null);
      }}
      className="relative w-full overflow-hidden"
      style={{
        height: canvasHeight,
        backgroundImage: `
          linear-gradient(to right, rgba(245,240,232,0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(245,240,232,0.04) 1px, transparent 1px)
        `,
        backgroundSize: `${cellW + GAP_PX}px ${ROW_PX + GAP_PX}px`,
        backgroundPosition: `${GAP_PX / 2}px ${GAP_PX / 2}px`,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--line)",
      }}
    >
      {widgets.map((w) => {
        const left = w.pos.x * (cellW + GAP_PX) + GAP_PX;
        const top  = w.pos.y * (ROW_PX + GAP_PX) + GAP_PX;
        const width  = w.pos.w * cellW + (w.pos.w - 1) * GAP_PX;
        const height = w.pos.h * ROW_PX + (w.pos.h - 1) * GAP_PX;
        const isSelected = selected === w.id;
        const isDragging = drag?.id === w.id;
        return (
          <div
            key={w.id}
            onPointerDown={(e) => onWidgetDown(e, w, "move")}
            className="absolute"
            style={{
              left, top, width, height,
              transition: isDragging ? "none" : "left 200ms cubic-bezier(.16,1,.3,1), top 200ms cubic-bezier(.16,1,.3,1), width 200ms ease, height 200ms ease",
              cursor: drag?.id === w.id && drag.mode === "move" ? "grabbing" : "grab",
              outline: isSelected ? "2px solid var(--mint)" : undefined,
              outlineOffset: isSelected ? "1px" : undefined,
              borderRadius: "var(--r-lg)",
              zIndex: isSelected ? 5 : 1,
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-[var(--r-lg)]">
              <WidgetRenderer
                widget={w}
                products={products}
                trials={trials}
                kpis={kpis}
                filters={filters}
              />
            </div>

            {/* Resize handles (only show when selected/hovered) */}
            <ResizeHandle
              edge="e"
              onPointerDown={(e) => onWidgetDown(e, w, "resize-e")}
              visible={isSelected || isDragging}
            />
            <ResizeHandle
              edge="s"
              onPointerDown={(e) => onWidgetDown(e, w, "resize-s")}
              visible={isSelected || isDragging}
            />
            <ResizeHandle
              edge="se"
              onPointerDown={(e) => onWidgetDown(e, w, "resize-se")}
              visible={isSelected || isDragging}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

type DragMode = "move" | "resize-e" | "resize-s" | "resize-se";
type DragSession = {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  original: { x: number; y: number; w: number; h: number };
};

function pxToCells(px: number, cellW: number): number {
  return Math.round(px / (cellW + GAP_PX));
}
function pxToRows(px: number): number {
  return Math.round(px / (ROW_PX + GAP_PX));
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function ResizeHandle({
  edge, onPointerDown, visible,
}: Readonly<{
  edge: "e" | "s" | "se";
  onPointerDown: (e: React.PointerEvent) => void;
  visible: boolean;
}>) {
  const opacity = visible ? 1 : 0;
  const common: React.CSSProperties = {
    position: "absolute",
    zIndex: 6,
    opacity,
    transition: "opacity 120ms ease",
  };
  let style: React.CSSProperties;
  if (edge === "se") {
    style = {
      ...common, right: -4, bottom: -4, width: 12, height: 12,
      cursor: "nwse-resize",
      background: "var(--mint)", borderRadius: 4,
      boxShadow: "0 0 0 1px var(--ink-soft)",
    };
  } else if (edge === "e") {
    style = {
      ...common, right: -3, top: 12, bottom: 12, width: 6,
      cursor: "ew-resize",
      background: "linear-gradient(to right, transparent, rgba(122,243,208,0.55))",
      borderRadius: 3,
    };
  } else {
    style = {
      ...common, left: 12, right: 12, bottom: -3, height: 6,
      cursor: "ns-resize",
      background: "linear-gradient(to bottom, transparent, rgba(122,243,208,0.55))",
      borderRadius: 3,
    };
  }
  return (
    <div
      data-resize-handle
      onPointerDown={onPointerDown}
      style={style}
      aria-label={`Resize ${edge}`}
    />
  );
}

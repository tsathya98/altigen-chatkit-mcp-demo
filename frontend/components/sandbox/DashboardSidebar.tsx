"use client";

/**
 * Left rail listing every saved dashboard. New / Duplicate / Rename /
 * Delete actions. Click a row to switch. Subtle "modified just now" hint
 * under the active one.
 */

import { Copy, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  deleteDashboard,
  duplicateDashboard,
  newDashboard,
  renameDashboard,
  setActiveDashboard,
  useSandboxState,
} from "@/lib/sandbox-store";

export function DashboardSidebar() {
  const s = useSandboxState();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 w-[240px] border-r border-[var(--line)] py-4 px-2 sticky top-0 self-start"
      style={{ height: "calc(100vh - 0px)" }}
    >
      <div className="px-2 mb-3 flex items-center justify-between">
        <span className="kicker">[ Dashboards ]</span>
        <button
          onClick={() => {
            const d = newDashboard("Untitled dashboard");
            setRenamingId(d.id);
            setDraft(d.title);
          }}
          title="New dashboard"
          className="p-1.5 rounded-md text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)] transition-colors"
        >
          <FilePlus2 size={13} />
        </button>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
        {s.order.map((id) => {
          const d = s.dashboards[id];
          if (!d) return null;
          const active = id === s.activeId;
          return (
            <li key={id}>
              {renamingId === id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => { renameDashboard(id, draft.trim() || "Untitled"); setRenamingId(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { renameDashboard(id, draft.trim() || "Untitled"); setRenamingId(null); }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="w-full bg-transparent border border-[var(--mint)] rounded-md px-2 py-1.5 text-[12.5px] text-[var(--bone)] outline-none"
                />
              ) : (
                <div
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[12.5px] cursor-pointer transition-colors ${
                    active
                      ? "bg-[var(--mint)]/[0.08] text-[var(--bone)]"
                      : "text-[var(--bone-soft)] hover:bg-[var(--surface-hi)]/40"
                  }`}
                  onClick={() => setActiveDashboard(id)}
                  title={d.title}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${active ? "bg-[var(--mint)]" : "bg-[var(--muted)]"}`} />
                  <span className="truncate flex-1">{d.title}</span>
                  <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(id); setDraft(d.title); }}
                      title="Rename"
                      className="p-1 rounded text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)]"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateDashboard(id); }}
                      title="Duplicate"
                      className="p-1 rounded text-[var(--muted-hi)] hover:text-[var(--bone)] hover:bg-[var(--surface-hi)]"
                    >
                      <Copy size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete dashboard "${d.title}"?`)) deleteDashboard(id);
                      }}
                      title="Delete"
                      className="p-1 rounded text-[var(--muted-hi)] hover:text-[var(--coral)] hover:bg-[var(--coral)]/10"
                    >
                      <Trash2 size={10} />
                    </button>
                  </span>
                </div>
              )}
              {active && d.widgets.length > 0 && (
                <div className="px-2 pb-1 font-mono text-[9.5px] text-[var(--muted)] tracking-wider uppercase">
                  {d.widgets.length} widget{d.widgets.length === 1 ? "" : "s"}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-2 pt-2 mt-2 border-t border-[var(--line)] font-mono text-[9.5px] text-[var(--muted)] tracking-wider uppercase">
        Stored locally · localStorage
      </div>
    </aside>
  );
}

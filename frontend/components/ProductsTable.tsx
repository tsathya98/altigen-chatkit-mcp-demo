import type { Product } from "@/lib/api";

const AREA_DOT: Record<string, string> = {
  Cardiology:  "var(--coral)",
  Neurology:   "var(--violet)",
  Oncology:    "var(--amber)",
  Immunology:  "var(--mint)",
  Metabolic:   "var(--bone-soft)",
};

export function ProductsTable({ products }: { products: Product[] }) {
  return (
    <div className="surface-soft p-0 overflow-hidden reveal" style={{ animationDelay: "320ms" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
        <div>
          <span className="kicker">[ Catalog · 06 assets ]</span>
          <div className="font-display-stand text-[22px] mt-1">Products</div>
        </div>
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-[var(--muted)]">
          Updated · live
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[10.5px] tracking-[0.16em] uppercase text-[var(--muted)]">
            <th className="px-5 py-3 font-normal w-10">#</th>
            <th className="py-3 pr-3 font-normal">Product</th>
            <th className="py-3 pr-3 font-normal">Indication</th>
            <th className="py-3 pr-3 font-normal">Area</th>
            <th className="py-3 pr-3 font-normal">Status</th>
            <th className="py-3 pr-5 font-normal text-right">Launched</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr
              key={p.name}
              className="border-t border-[var(--line)] hover:bg-[var(--surface-hi)]/40 transition-colors group"
            >
              <td className="px-5 py-3.5 font-mono text-[11px] tabular text-[var(--muted)]">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="py-3.5 pr-3">
                <div className="font-display-stand text-[18px] text-[var(--bone)]">{p.name}</div>
              </td>
              <td className="py-3.5 pr-3 text-[var(--bone-soft)] text-[13px]">{p.indication}</td>
              <td className="py-3.5 pr-3">
                <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase text-[var(--muted-hi)]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: AREA_DOT[p.therapy_area] ?? "var(--muted)" }}
                  />
                  {p.therapy_area}
                </span>
              </td>
              <td className="py-3.5 pr-3">
                <span className={`font-mono text-[11px] tracking-wider uppercase ${
                  p.status === "Marketed"
                    ? "text-[var(--mint)]"
                    : "text-[var(--amber)]"
                }`}>
                  {p.status}
                </span>
              </td>
              <td className="py-3.5 pr-5 text-right font-mono tabular text-[12px] text-[var(--bone-soft)]">
                {p.launch_year ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type Product = {
  name: string;
  indication: string;
  therapy_area: string;
  status: string;
  launch_year: number | null;
};

export type Trial = {
  trial_id: string;
  product: string;
  phase: string;
  status: string;
  enrollment_target: number;
  enrollment_actual: number;
  start_date: string;
  primary_endpoint: string;
};

export type Kpi = {
  name: string;
  function: string;
  period: string;
  value: number;
  unit: string;
  target: number | null;
};

function baseUrl(): string {
  // Browser: relative URLs work — Next.js rewrites proxy /api/* to the backend.
  if (typeof window !== "undefined") return "";
  // Server (RSC / route handlers): rewrites do NOT fire, need an absolute URL.
  return process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${baseUrl()}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

export const fetchProducts = () => get<Product[]>("/api/products");
export const fetchTrials   = () => get<Trial[]>("/api/trials");
export const fetchKpis     = (period?: string) =>
  get<Kpi[]>("/api/kpis" + (period ? `?period=${period}` : ""));

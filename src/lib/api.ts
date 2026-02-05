/**
 * PulseCheck API client.
 * Uses Vite proxy in dev (/api -> backend) or VITE_API_URL when set.
 */

import type { ProductReport } from "@/data/mockData";

const API_BASE =
  import.meta.env.VITE_API_URL ?? "";

function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export async function fetchReport(productName: string): Promise<ProductReport> {
  const res = await fetch(apiUrl("/api/reports"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName: productName.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSuggestions(): Promise<string[]> {
  const res = await fetch(apiUrl("/api/suggestions"));
  if (!res.ok) throw new Error("Failed to load suggestions");
  return res.json();
}

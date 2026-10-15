export interface ApiResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  error: string | null;
  field?: string;
}

/** Small fetch wrapper for the link APIs: always resolves, never throws. */
export async function apiRequest(url: string, method: "POST" | "PATCH" | "DELETE" | "GET", body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      /* empty body */
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.",
      field: typeof data?.field === "string" ? data.field : undefined,
    };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error. Please try again." };
  }
}

/** ISO timestamp -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string ("" -> null). */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

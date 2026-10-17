/**
 * Minimal Vercel Domains API client (Batch 11). Optional: with no token configured the
 * app falls back to a manual connection flow (see lib/domains/service.ts).
 *
 * Endpoints (checked against Vercel's REST docs):
 *   POST   /v10/projects/{id}/domains            add a domain to the project
 *   POST   /v9/projects/{id}/domains/{d}/verify  re-run Vercel's own verification
 *   GET    /v6/domains/{d}/config                `misconfigured` tells whether DNS is right
 *   DELETE /v9/projects/{id}/domains/{d}         remove it again
 * The token is read from the environment and is never logged or returned to the browser.
 */
export interface VercelConfig {
  token: string;
  projectId: string;
  teamId: string | null;
}

export function getVercelConfig(env: Record<string, string | undefined> = process.env): VercelConfig | null {
  const token = env.VERCEL_API_TOKEN?.trim();
  const projectId = env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: env.VERCEL_TEAM_ID?.trim() || null };
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type VercelResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

function url(cfg: VercelConfig, path: string): string {
  const q = cfg.teamId ? `?teamId=${encodeURIComponent(cfg.teamId)}` : "";
  return `https://api.vercel.com${path}${q}`;
}

async function call<T>(cfg: VercelConfig, method: string, path: string, body: unknown, f: FetchLike): Promise<VercelResult<T>> {
  try {
    const res = await f(url(cfg, path), {
      method,
      headers: { Authorization: `Bearer ${cfg.token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } } | null)?.error?.message;
      return { ok: false, status: res.status, message: typeof msg === "string" ? msg.slice(0, 200) : `Vercel returned HTTP ${res.status}` };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, message: "Could not reach the Vercel API." };
  }
}

const defaultFetch: FetchLike = (u, init) => fetch(u, init);

export interface AddDomainData {
  verified?: boolean;
}

/** "Already on this project" (400) counts as success: adding is idempotent for us. */
export async function addDomain(cfg: VercelConfig, name: string, f: FetchLike = defaultFetch): Promise<VercelResult<AddDomainData>> {
  const res = await call<AddDomainData>(cfg, "POST", `/v10/projects/${encodeURIComponent(cfg.projectId)}/domains`, { name }, f);
  if (!res.ok && res.status === 400 && /already/i.test(res.message)) return { ok: true, data: { verified: undefined } };
  return res;
}

export async function verifyDomain(cfg: VercelConfig, name: string, f: FetchLike = defaultFetch): Promise<VercelResult<AddDomainData>> {
  return call<AddDomainData>(cfg, "POST", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(name)}/verify`, {}, f);
}

export async function getDomainConfig(cfg: VercelConfig, name: string, f: FetchLike = defaultFetch): Promise<VercelResult<{ misconfigured: boolean }>> {
  const res = await call<{ misconfigured?: boolean }>(cfg, "GET", `/v6/domains/${encodeURIComponent(name)}/config`, undefined, f);
  if (!res.ok) return res;
  return { ok: true, data: { misconfigured: res.data?.misconfigured !== false } };
}

export async function removeDomain(cfg: VercelConfig, name: string, f: FetchLike = defaultFetch): Promise<VercelResult<null>> {
  const res = await call<unknown>(cfg, "DELETE", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(name)}`, undefined, f);
  if (!res.ok && res.status === 404) return { ok: true, data: null };
  return res.ok ? { ok: true, data: null } : res;
}

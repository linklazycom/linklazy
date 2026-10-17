import { authenticateApi, apiError, apiJson } from "@/lib/api/auth";
import { createLinkSchema, parsePaging, publicLink } from "@/lib/api/links";
import { createShortLink, LINK_COLUMNS } from "@/lib/links/service";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { safeSearchTerm } from "@/lib/links/fields";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "links:read");
  if ("error" in auth) return auth.error;

  const params = new URL(request.url).searchParams;
  const { page, perPage } = parsePaging(params);
  const q = safeSearchTerm(params.get("q") ?? undefined);
  const folder = (params.get("folder") ?? "").slice(0, 100);
  const tag = (params.get("tag") ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);

  let query = createServiceClient().from("short_links").select(LINK_COLUMNS, { count: "exact" }).eq("user_id", auth.ctx.userId);
  if (q) query = query.or(`slug.ilike.%${q}%,title.ilike.%${q}%,destination_url.ilike.%${q}%`);
  if (folder) query = query.eq("folder", folder);
  if (tag) query = query.contains("tags", [tag]);

  const from = (page - 1) * perPage;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + perPage - 1);
  if (error) return apiError(500, "server_error", "Could not load links.");
  return apiJson({ data: (data ?? []).map((r) => publicLink(r as unknown as Record<string, unknown>)), page, per_page: perPage, total: count ?? 0 });
}

export async function POST(request: Request) {
  const auth = await authenticateApi(request, "links:write");
  if ("error" in auth) return auth.error;

  const parsed = createLinkSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", "Invalid request body. 'destination_url' is required and unknown fields are not allowed.");

  const res = await createShortLink({ userId: auth.ctx.userId, isAdmin: auth.ctx.isAdmin, createdAt: auth.ctx.createdAt }, parsed.data);
  if (!res.ok) return apiError(res.status, res.status === 429 ? "rate_limited" : res.status === 409 ? "conflict" : res.status === 403 ? "limit_reached" : "invalid_request", res.error);
  return apiJson({ data: publicLink(res.data) }, 201);
}

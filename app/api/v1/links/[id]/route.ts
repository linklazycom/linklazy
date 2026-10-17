import { authenticateApi, apiError, apiJson } from "@/lib/api/auth";
import { updateLinkSchema, publicLink, UUID } from "@/lib/api/links";
import { updateShortLink, deleteShortLink, LINK_COLUMNS } from "@/lib/links/service";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const notFound = () => apiError(404, "not_found", "Link not found.");

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return notFound();
  const auth = await authenticateApi(request, "links:read");
  if ("error" in auth) return auth.error;

  const { data } = await createServiceClient().from("short_links").select(LINK_COLUMNS).eq("id", id).eq("user_id", auth.ctx.userId).maybeSingle();
  return data ? apiJson({ data: publicLink(data as unknown as Record<string, unknown>) }) : notFound();
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return notFound();
  const auth = await authenticateApi(request, "links:write");
  if ("error" in auth) return auth.error;

  const parsed = updateLinkSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "invalid_request", "Invalid request body. Unknown fields are not allowed (the slug cannot be changed).");

  const res = await updateShortLink({ userId: auth.ctx.userId, isAdmin: auth.ctx.isAdmin, createdAt: auth.ctx.createdAt }, id, parsed.data);
  if (!res.ok) return apiError(res.status, res.status === 404 ? "not_found" : "invalid_request", res.error);
  return apiJson({ data: publicLink(res.data) });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return notFound();
  const auth = await authenticateApi(request, "links:write");
  if ("error" in auth) return auth.error;

  const res = await deleteShortLink({ userId: auth.ctx.userId, isAdmin: auth.ctx.isAdmin, createdAt: auth.ctx.createdAt }, id);
  if (!res.ok) return apiError(res.status, res.status === 404 ? "not_found" : "server_error", res.error);
  return apiJson({ data: { id, deleted: true } });
}

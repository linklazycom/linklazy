import { authenticateApi, apiError, apiJson } from "@/lib/api/auth";
import { UUID } from "@/lib/api/links";
import { createServiceClient } from "@/lib/supabase/service";
import { parseAnalytics } from "@/lib/analytics/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.safeParse(id).success) return apiError(404, "not_found", "Link not found.");
  const auth = await authenticateApi(request, "links:read");
  if ("error" in auth) return auth.error;

  const days = Math.max(1, Math.min(365, Number.parseInt(new URL(request.url).searchParams.get("days") ?? "30", 10) || 30));
  const svc = createServiceClient();
  // Ownership is proven here (the SQL function itself is service-role only).
  const { data: link } = await svc.from("short_links").select("id").eq("id", id).eq("user_id", auth.ctx.userId).maybeSingle();
  if (!link) return apiError(404, "not_found", "Link not found.");

  const { data: raw, error } = await svc.rpc("link_analytics_data", { p_link_id: id, p_days: days });
  const a = error ? null : parseAnalytics(raw);
  if (!a) return apiError(500, "server_error", "Statistics are not available right now.");
  return apiJson({
    data: {
      days: a.days,
      from: a.from,
      totals: a.totals,
      daily: a.daily,
      countries: a.countries,
      devices: a.devices,
      browsers: a.browsers,
      referrers: a.referrers,
      sources: a.sources,
    },
  });
}

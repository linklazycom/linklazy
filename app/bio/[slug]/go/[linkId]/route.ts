import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlausibleSlug, normalizeSlug } from "@/lib/links/slug";
import { isSafeRedirectTarget, hostMatchesDomain } from "@/lib/links/url";
import { isLikelyBot } from "@/lib/links/bot";
import { getLinkBlocklist, isLinkFeatureOn } from "@/lib/links/server";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

/** Counts a click on a bio-page link, then redirects. Re-checks takedown/blocklist on every click. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; linkId: string }> }) {
  const { slug: rawSlug, linkId } = await params;
  const slug = normalizeSlug(rawSlug);
  const back = new NextResponse(null, { status: 404, headers: HEADERS });
  if (!isPlausibleSlug(slug) || !/^[0-9a-f-]{36}$/i.test(linkId)) return back;
  if (!(await isLinkFeatureOn())) return back;

  const svc = createServiceClient();
  const { data: page } = await svc.from("bio_pages").select("id, slug, is_published, disabled_reason").eq("slug", slug).maybeSingle();
  if (!page || !page.is_published || page.disabled_reason) return back;
  const { data: link } = await svc.from("bio_links").select("id, url, is_active").eq("id", linkId).eq("bio_id", page.id).maybeSingle();
  if (!link || !link.is_active || !isSafeRedirectTarget(link.url)) return back;

  const blocklist = await getLinkBlocklist();
  const host = new URL(link.url).hostname;
  if (blocklist.domains.some((d) => hostMatchesDomain(host, d))) return back;

  if (!isLikelyBot(request.headers.get("user-agent"))) {
    after(async () => {
      await createServiceClient().rpc("bump_bio_link_click", { p_link_id: link.id });
    });
  }
  return NextResponse.redirect(link.url, { status: 302, headers: HEADERS });
}

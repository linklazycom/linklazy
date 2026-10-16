import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BioView } from "@/components/bio/bio-view";
import { isPlausibleSlug, normalizeSlug } from "@/lib/links/slug";
import { isLikelyBot } from "@/lib/links/bot";
import { isLinkFeatureOn } from "@/lib/links/server";

export const dynamic = "force-dynamic";

async function loadPage(rawSlug: string) {
  const slug = normalizeSlug(rawSlug);
  if (!isPlausibleSlug(slug)) return null;
  const svc = createServiceClient();
  const { data: page } = await svc
    .from("bio_pages")
    .select("id, slug, display_name, bio, avatar_url, theme, is_published, disabled_reason")
    .eq("slug", slug)
    .maybeSingle();
  if (!page || !page.is_published || page.disabled_reason) return null;
  const { data: links } = await svc
    .from("bio_links")
    .select("id, title")
    .eq("bio_id", page.id)
    .eq("is_active", true)
    .order("position", { ascending: true });
  return { page, links: links ?? [] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await loadPage((await params).slug);
  if (!data) return { title: "Page not found", robots: { index: false, follow: false } };
  return {
    title: `${data.page.display_name} | LinkLazy`,
    description: data.page.bio?.slice(0, 160) ?? `Links from ${data.page.display_name}`,
  };
}

export default async function PublicBioPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isLinkFeatureOn())) notFound();
  const data = await loadPage((await params).slug);
  if (!data) notFound();
  const { page, links } = data;

  const ua = (await headers()).get("user-agent");
  if (!isLikelyBot(ua)) {
    after(async () => {
      await createServiceClient().rpc("bump_bio_view", { p_bio_id: page.id });
    });
  }

  return (
    <main className="flex min-h-screen">
      <BioView
        displayName={page.display_name}
        bio={page.bio}
        avatarUrl={page.avatar_url}
        theme={page.theme}
        links={links.map((l) => ({ id: l.id, title: l.title, href: `/bio/${page.slug}/go/${l.id}` }))}
      />
    </main>
  );
}

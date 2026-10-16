import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BioEditor } from "@/components/bio/bio-editor";
import { isLinkFeatureOn, siteUrl } from "@/lib/links/server";

export const metadata = { title: "Edit bio page" };

export default async function EditBioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: page } = await supabase
    .from("bio_pages")
    .select("id, user_id, slug, display_name, bio, avatar_url, theme, is_published, view_count, disabled_reason")
    .eq("id", id)
    .maybeSingle();
  if (!page || page.user_id !== user.id) notFound();
  if (!(await isLinkFeatureOn())) return <p className="text-muted">Link management is temporarily turned off.</p>;

  const { data: links } = await supabase.from("bio_links").select("id, title, url, is_active, click_count").eq("bio_id", id).order("position", { ascending: true });

  return (
    <div className="space-y-4">
      <Link href="/dashboard/bio" className="text-sm text-muted underline">
        ← Bio pages
      </Link>
      {page.disabled_reason && (
        <div className="rounded-chip border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This page has been disabled{page.disabled_reason === "owner_banned" ? " because your account is restricted." : " by our team because it may violate our acceptable-use policy."} Contact support if you think this is a mistake.
        </div>
      )}
      <BioEditor
        page={{
          id: page.id,
          slug: page.slug,
          display_name: page.display_name,
          bio: page.bio,
          avatar_url: page.avatar_url,
          theme: page.theme,
          is_published: page.is_published,
          view_count: page.view_count,
          locked: !!page.disabled_reason,
        }}
        initialLinks={links ?? []}
        siteUrl={siteUrl()}
      />
    </div>
  );
}

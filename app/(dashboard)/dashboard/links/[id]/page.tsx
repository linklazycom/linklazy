import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinkEditForm } from "@/components/links/link-edit-form";
import { QrPanel } from "@/components/links/qr-panel";
import { CopyButton } from "@/components/links/copy-button";
import { linkStatus } from "@/lib/links/rules";
import { isLinkFeatureOn, shortUrlFor } from "@/lib/links/server";

export const metadata = { title: "Edit short link" };

export default async function EditLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: link } = await supabase
    .from("short_links")
    .select("id, user_id, slug, destination_url, title, folder, tags, is_active, has_password, project_id, expires_at, max_clicks, click_count, disabled_reason, disabled_note, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!link || link.user_id !== user.id) notFound();

  if (!(await isLinkFeatureOn())) {
    return <p className="text-muted">Link management is temporarily turned off.</p>;
  }

  const { data: projects } = await supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(200);
  const short = shortUrlFor(link.slug);
  const st = linkStatus(link);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/links" className="text-sm text-muted underline">
          ← All links
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium">{link.title || link.slug}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a href={short} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-sm text-brand-violet underline">
            {short}
          </a>
          <CopyButton text={short} />
          <Link href={`/dashboard/links/${link.id}/analytics`} className="text-sm text-brand-violet underline">
            View analytics →
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted">
          {link.click_count} clicks · status: {st.replace("_", " ")} · the slug cannot be changed (it would break printed QR codes and shared links)
        </p>
      </div>

      {link.disabled_reason && (
        <div className="rounded-chip border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This link has been disabled
          {link.disabled_reason === "owner_banned" ? " because your account is restricted." : " by our team because it may violate our acceptable-use policy."} Contact support if you think this is a mistake.
        </div>
      )}

      <LinkEditForm
        link={{
          id: link.id,
          destination_url: link.destination_url,
          title: link.title,
          folder: link.folder,
          tags: link.tags ?? [],
          expires_at: link.expires_at,
          max_clicks: link.max_clicks,
          is_active: link.is_active,
          has_password: link.has_password,
          project_id: link.project_id ?? null,
          locked: !!link.disabled_reason,
        }}
        projects={projects ?? []}
      />

      <QrPanel id={link.id} slug={link.slug} />
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { BioCreateForm } from "@/components/bio/bio-create-form";
import { CopyButton } from "@/components/links/copy-button";
import { getLinkLimits, isLinkFeatureOn, siteUrl } from "@/lib/links/server";

export const metadata = { title: "Bio pages" };

export default async function BioPagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!(await isLinkFeatureOn())) return <p className="text-muted">Link management is temporarily turned off.</p>;

  const [{ data: pages }, limits, { data: profile }] = await Promise.all([
    supabase.from("bio_pages").select("id, slug, display_name, theme, is_published, view_count, disabled_reason").eq("user_id", user.id).order("created_at", { ascending: false }),
    getLinkLimits(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const isAdmin = profile?.role === "admin";
  const canCreate = isAdmin || (pages?.length ?? 0) < limits.bio_max_pages;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Bio pages</h1>
        <p className="text-sm text-muted">
          One page with all your important links, at a short address you can share anywhere.
          {isAdmin ? "" : ` ${pages?.length ?? 0} of ${limits.bio_max_pages} used.`}
        </p>
      </div>

      {(pages ?? []).map((p) => {
        const url = `${siteUrl()}/bio/${p.slug}`;
        return (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-chip border border-line bg-white p-4">
            <div className="min-w-0">
              <p className="font-medium">
                {p.display_name}{" "}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${p.disabled_reason ? "bg-red-50 text-red-700" : p.is_published ? "bg-signal-soft text-signal" : "bg-line/60 text-muted"}`}>
                  {p.disabled_reason ? "Disabled" : p.is_published ? "Published" : "Draft"}
                </span>
              </p>
              <p className="break-all font-mono text-xs text-brand-violet">{url}</p>
              <p className="text-xs text-muted">{p.view_count} views</p>
            </div>
            <div className="flex gap-2">
              <CopyButton text={url} />
              <Link href={`/dashboard/bio/${p.id}`}>
                <Button size="sm" type="button">
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        );
      })}

      {canCreate ? <BioCreateForm siteUrl={siteUrl()} /> : <p className="text-sm text-muted">You've reached your bio-page limit.</p>}
    </div>
  );
}

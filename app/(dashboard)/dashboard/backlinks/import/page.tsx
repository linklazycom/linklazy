import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BacklinkImportForm } from "@/components/backlinks/backlink-import-form";
import { isBacklinkMonitorOn } from "@/lib/backlinks/feature";
import { IMPORT_MAX_ROWS } from "@/lib/backlinks/rules";

export const metadata = { title: "Import backlinks" };

export default async function ImportBacklinksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const on = await isBacklinkMonitorOn();
  const { data: projects } = await supabase.from("projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true }).limit(200);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/backlinks" className="text-sm text-muted underline">
          ← All backlinks
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium">Import backlinks</h1>
      </div>
      {on ? <BacklinkImportForm projects={projects ?? []} maxRows={IMPORT_MAX_ROWS} /> : <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">Backlink monitoring is currently turned off.</p>}
    </div>
  );
}

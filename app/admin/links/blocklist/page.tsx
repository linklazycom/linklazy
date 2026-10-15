import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminBlocklistManager } from "@/components/admin/links/admin-blocklist-manager";

export const metadata = { title: "Admin · Link blocklist" };

export default async function AdminLinkBlocklistPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("link_blocklist").select("id, kind, value, reason, created_at").order("created_at", { ascending: false }).limit(500);
  return (
    <div className="space-y-4">
      <Link href="/admin/links" className="text-sm text-muted underline">
        ← Short links
      </Link>
      <h1 className="font-display text-2xl font-medium">Link blocklist</h1>
      <p className="text-sm text-muted">
        A blocked domain stops new links to it, and existing links to it stop redirecting (within about a minute). Built-in rules (URL shorteners, private addresses, reserved slugs) always apply.
      </p>
      <AdminBlocklistManager entries={data ?? []} />
    </div>
  );
}

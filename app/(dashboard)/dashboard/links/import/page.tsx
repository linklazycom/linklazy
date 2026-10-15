import Link from "next/link";
import { BulkImportForm } from "@/components/links/bulk-import-form";
import { getLinkLimits, isLinkFeatureOn } from "@/lib/links/server";

export const metadata = { title: "Import short links" };

export default async function ImportLinksPage() {
  if (!(await isLinkFeatureOn())) return <p className="text-muted">Link management is temporarily turned off.</p>;
  const limits = await getLinkLimits();
  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/dashboard/links" className="text-sm text-muted underline">
        ← All links
      </Link>
      <h1 className="font-display text-2xl font-medium">Import short links from CSV</h1>
      <BulkImportForm maxRows={limits.link_bulk_max_rows} />
    </div>
  );
}

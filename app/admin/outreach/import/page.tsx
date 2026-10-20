import Link from "next/link";
import { OutreachImportForm } from "@/components/admin/outreach/import-form";

export const metadata = { title: "Admin · Import outreach contacts" };

export default function AdminOutreachImportPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/outreach" className="text-sm text-muted underline">← Outreach</Link>
      <h1 className="font-display text-2xl font-medium">Import contacts</h1>
      <p className="text-sm text-muted">
        Up to 5000 rows per file. Always press &quot;Check the file&quot; first: it shows what would be added and why rows are skipped, and saves nothing. Invalid, duplicate and do-not-email addresses are skipped automatically. People in the EU/EEA, UK and Switzerland, and lists you bought or collected, are imported as <strong>held</strong>.
      </p>
      <OutreachImportForm />
    </div>
  );
}

import Link from "next/link";
import { TemplateCopy } from "@/components/admin/outreach/template-copy";
import { getSenderIdentity } from "@/lib/outreach/server";
import { senderIsComplete } from "@/lib/outreach/sender";
import { buildOutreachTemplate } from "@/lib/outreach/template";
import { FIELD_DEFS } from "@/lib/outreach/saleshandy";

export const metadata = { title: "Admin · Outreach email template" };
export const dynamic = "force-dynamic";

export default async function AdminOutreachTemplatePage() {
  const sender = await getSenderIdentity();
  const ready = senderIsComplete(sender);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com";
  const t = buildOutreachTemplate({
    senderName: ready ? sender.name : "[Your business name]",
    senderAddress: ready ? sender.address : "[Your postal address]",
    siteUrl,
  });
  const customNames = FIELD_DEFS.filter((f) => f.custom).map((f) => f.saleshandyName);

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/outreach" className="text-sm text-muted underline">← Outreach</Link>
      <h1 className="font-display text-2xl font-medium">Outreach email template</h1>
      {!ready && <p className="rounded-chip border border-amber-300 bg-amber-50 p-3 text-sm">Save your sender name and postal address in Outreach &gt; Overview first: they are printed at the bottom of the email.</p>}
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>In Saleshandy create these custom prospect fields with exactly these names: <strong>{customNames.join(", ")}</strong>.</li>
        <li>In your sequence, add the first step, paste the HTML below into the email editor&apos;s HTML/source view (or the plain-text version if you prefer plain emails), and choose a subject line.</li>
        <li>Where Saleshandy shows the <code>{"{{…}}"}</code> tags as fields, set a fallback text (for example &ldquo;there&rdquo; for First Name). The wording of fallbacks is set in the editor.</li>
        <li>In the sequence settings switch on Saleshandy&apos;s unsubscribe link, then <strong>send yourself a test</strong> before any real contact: check the price, the link and the footer.</li>
        <li>Check the claims in the text (for example the payment protection sentence) match how LinkLazy really works before you send.</li>
      </ol>
      <TemplateCopy subjects={t.subjects} html={t.html} text={t.text} />
    </div>
  );
}

import Link from "next/link";
import { SaleshandyForm } from "@/components/admin/outreach/saleshandy-form";
import { loadConnection } from "@/lib/outreach/saleshandy-server";

export const metadata = { title: "Admin · Saleshandy connection" };
export const dynamic = "force-dynamic";

export default async function AdminSaleshandyPage() {
  const conn = await loadConnection();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const webhookUrl = conn && siteUrl ? `${siteUrl}/api/webhooks/saleshandy/${conn.webhook_secret}` : null;

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/outreach" className="text-sm text-muted underline">← Outreach</Link>
      <h1 className="font-display text-2xl font-medium">Saleshandy connection</h1>
      <p className="text-sm text-muted">
        LinkLazy keeps your contacts and safety rules and hands each day&apos;s batch to Saleshandy, which sends the emails from the mailboxes you connected (and warmed up) there. Replies, bounces and unsubscribes come back through the webhook below. Mailbox connection and warm-up stay in Saleshandy.
      </p>
      <SaleshandyForm
        keyHint={conn?.api_key_encrypted ? conn.api_key_hint : null}
        fieldMap={conn?.field_map ?? {}}
        lastTest={{ at: conn?.last_test_at ?? null, ok: conn?.last_test_ok ?? null, message: conn?.last_test_message ?? null }}
        webhookUrl={conn?.api_key_encrypted ? webhookUrl : null}
      />
    </div>
  );
}

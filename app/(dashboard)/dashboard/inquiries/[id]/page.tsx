import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InquiryChatWindow } from "@/components/inquiries/inquiry-chat-window";

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id, site_id, buyer_id, seller_id, sites(domain, niche)")
    .eq("id", id)
    .single();

  if (!inquiry || (inquiry.buyer_id !== user.id && inquiry.seller_id !== user.id)) {
    notFound();
  }

  // @ts-expect-error -- joined relation shape isn't in the placeholder Database type
  const site = inquiry.sites as { domain: string; niche: string } | null;
  const role = inquiry.buyer_id === user.id ? "buyer" : "seller";

  return (
    <div className="max-w-xl">
      <Link href="/dashboard/inquiries" className="mb-4 inline-block text-sm text-muted underline">
        ← All inquiries
      </Link>
      <h1 className="mb-1 font-display text-2xl font-medium">{site?.domain ?? "Site"}</h1>
      <p className="mb-6 text-sm text-muted">
        {site?.niche} · you&apos;re the {role} in this conversation
      </p>
      <InquiryChatWindow inquiryId={inquiry.id} userId={user.id} />
      {role === "buyer" && (
        <Link href={`/dashboard/browse/${inquiry.site_id}`} className="mt-4 inline-block text-sm text-brand-blue underline">
          View site & place an order →
        </Link>
      )}
    </div>
  );
}

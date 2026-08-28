import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";
import { createClient } from "@/lib/supabase/server";
import { TicketForm } from "@/components/support/ticket-form";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Get Support",
  description: "Open a support ticket and get a reply from the LinkLazy team.",
};

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Support is for buyers/sellers with an account, not a general contact
  // form — send logged-out visitors to log in (or create an account)
  // first, then bring them straight back here.
  if (!user) {
    redirect("/login?next=/support");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main>
      <PageHero
        eyebrow="We're here to help"
        eyebrowIcon={LifeBuoy}
        title="Get Support"
        description="Questions, disputes, or partnership inquiries — we reply directly to your email."
      />

      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="mb-8 text-sm text-muted">
          Open a ticket below and we&apos;ll reply directly to your email.
          It&apos;ll also show up under{" "}
          <Link href="/dashboard/support" className="text-brand-violet underline">
            My tickets
          </Link>{" "}
          in your dashboard. Prefer email?{" "}
          <a href={`mailto:${email}`} className="text-brand-violet underline">
            {email}
          </a>
        </p>
        <TicketForm contactEmail={email} defaultName={profile?.full_name ?? ""} defaultEmail={user.email ?? ""} />
      </div>
    </main>
  );
}

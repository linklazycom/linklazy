import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";
import { TicketForm } from "@/components/support/ticket-form";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Support",
  description: "Open a support ticket and get a reply from the LinkLazy team.",
};

export default async function SupportPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main>
      <PageHero
        eyebrow="We're here to help"
        eyebrowIcon={LifeBuoy}
        title="Support"
        description="Questions, disputes, or partnership inquiries — we reply directly to your email."
      />

      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="mb-8 text-sm text-muted">
          Open a ticket below and we&apos;ll reply directly to your email.
          You&apos;ll also get a private link to track and continue the
          conversation. Prefer email?{" "}
          <a href={`mailto:${email}`} className="text-brand-violet underline">
            {email}
          </a>
        </p>
        <TicketForm contactEmail={email} />
      </div>
    </main>
  );
}

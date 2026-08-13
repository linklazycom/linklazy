import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { TicketForm } from "@/components/support/ticket-form";

export const metadata: Metadata = {
  title: "Support",
  description: "Open a support ticket and get a reply from the LinkLazy team.",
};

export default async function SupportPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Support</h1>
      <p className="mb-8 text-sm text-muted">
        Questions, disputes, or partnership inquiries — open a ticket below
        and we'll reply directly to your email. You'll also get a private
        link to track and continue the conversation. Prefer email?{" "}
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>
      </p>
      <TicketForm contactEmail={email} />
    </main>
  );
}

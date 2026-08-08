import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the LinkLazy team.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Contact</h1>
      <p className="mb-8 text-sm text-muted">
        Questions, disputes, or partnership inquiries — reach us at{" "}
        <a href={`mailto:${email}`} className="underline">
          {email}
        </a>{" "}
        or use the form below.
      </p>
      <ContactForm contactEmail={email} />
    </main>
  );
}

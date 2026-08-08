import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How LinkLazy collects, uses, and protects your data.",
};

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-6 text-sm leading-7 text-ink">
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">1. Information we collect</h2>
          <p>
            When you register an account, we collect your name, email address,
            and role (buyer, seller, or both). When you list a site, we
            collect the site URL, ownership verification data, and metrics
            you submit. When you use the platform, we automatically collect
            usage data such as pages visited, referring source, and general
            device information, used to operate and improve the service.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">2. How we use your information</h2>
          <p>
            We use your information to operate the marketplace: creating and
            managing orders, processing payments, verifying site ownership,
            preventing fraud and abuse, communicating service updates, and
            improving our product. We do not sell your personal information
            to third parties.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">3. Payment information</h2>
          <p>
            Payments are processed through our payment provider (currently
            bKash). We do not store your full payment credentials on our
            servers — payment processing is handled directly by the provider,
            and we retain only transaction references necessary for order
            records and support.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">4. Messages and moderation</h2>
          <p>
            In-platform messages between buyers and sellers are automatically
            scanned to detect and mask personal contact information (such as
            phone numbers, emails, or social handles), in order to keep
            transactions safe and on-platform. Original, unmasked message
            content may be retained for moderation and dispute-resolution
            purposes only.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">5. Data retention</h2>
          <p>
            We retain account and transaction data for as long as your
            account is active and as needed to comply with legal obligations,
            resolve disputes, and enforce our agreements.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">6. Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your
            personal data by contacting us at{" "}
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>
            . Some data may be retained where required for legal, security,
            or dispute-resolution purposes.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">7. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes
            will be reflected by an updated &quot;last updated&quot; date on
            this page.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">8. Contact</h2>
          <p>
            Questions about this policy can be sent to{" "}
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

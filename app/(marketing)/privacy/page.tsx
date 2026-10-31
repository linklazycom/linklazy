import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy Policy",
  description: "How LinkLazy collects, uses, and protects your data.",
};

/** Update this date whenever the text changes (it used to show today's date on every visit, which is misleading for legal text). */
const LEGAL_UPDATED = "30 October 2026";

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main>
      <PageHero
        eyebrow="Legal"
        eyebrowIcon={Lock}
        title="Privacy Policy"
        description={`Last updated: ${LEGAL_UPDATED}`}
      />

      <div className="mx-auto max-w-2xl px-6 py-16">
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
          <h2 className="mb-2 font-display text-lg font-medium">3. Payout details</h2>
          <p>
            If you ask to withdraw money, we store the payout details you enter (a bKash or Nagad number, or a bank account number, account holder name, bank name and optional branch and routing number) and the transaction ID of the payout we send. They are used only to review and pay your request and to keep our accounting records, and are visible to our admin team.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">4. Payment information</h2>
          <p>
            Payments are processed through our payment providers (currently
            bKash and PayPal). We do not store your full payment credentials
            on our servers — payment processing is handled directly by these
            providers, and we retain only transaction references necessary
            for order records and support. If you use our Pay-Per-View
            wallet feature, we also retain your wallet balance and
            transaction history to accurately track funding, spending, and
            payouts.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">5. Messages and moderation</h2>
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
          <h2 className="mb-2 font-display text-lg font-medium">6. Support tickets</h2>
          <p>
            When you contact support, we store your name, email, and message
            history to respond to your request. If you&apos;re logged in, your
            ticket is linked to your account so you can view it under My
            Tickets; if you contact us as a guest, your ticket is accessible
            only via a private link containing a unique access token. Support
            ticket data is retained to maintain a record of past support
            interactions and is not shared outside the team handling your
            request.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">7. Short-link click data</h2>
          <p>
            When someone opens a LinkLazy short link, we record the time, whether it was a direct visit or a QR scan, the visitor&apos;s country (two-letter code), device type, browser type, and the website they came from. We also store a one-way hash made from a daily-changing secret plus the visitor&apos;s IP address and browser details, only to avoid counting the same visitor twice in a short time. We do not store the raw IP address in the click record. Detailed click rows are summarised into daily totals and deleted after the retention period set by LinkLazy (90 days by default); the daily totals are kept so the link owner&apos;s analytics continue to work.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">8. Site visit analytics</h2>
          <p>
            To understand how our site is used, we record the page visited, the referring address, campaign tags in the link (such as utm_source), and your account ID if you are signed in. This record does not include your IP address.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">9. Service providers and AI tools</h2>
          <p>
            We use trusted providers to run LinkLazy: payment processors (PayPal and bKash), an email delivery provider, hosting and database providers, and providers of SEO data and AI features. We share with them only what is needed to provide the service you asked for, for example the text you submit to an AI tool is sent to the AI provider to produce the result. Please do not enter passwords, secrets or other people&apos;s personal data into AI tools.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">10. Backlink monitoring and outreach</h2>
          <p>
            If you add backlinks to our monitoring feature, our system opens the page addresses you provide on a schedule to check whether your link is present, and stores the result and the time of the check. We may also email site owners to invite them to list their site on LinkLazy; every such email contains a way to unsubscribe.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">11. Notifications</h2>
          <p>
            We generate in-platform notifications (such as order updates, new
            exchange matches, reviews, and messages) based on activity on
            your account and the accounts of users you transact with. These
            notifications are visible only to the account they belong to.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">12. Referral program</h2>
          <p>
            If you participate in our referral program, we associate new
            accounts that sign up using your referral link with your
            account, and track commission credits earned from their
            completed paid orders. This data is used solely to calculate and
            display your referral earnings and is not shared with the
            referred user beyond what&apos;s necessary to operate the program.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">13. Data retention</h2>
          <p>
            We retain account and transaction data for as long as your
            account is active and as needed to comply with legal obligations,
            resolve disputes, and enforce our agreements.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">14. Your rights</h2>
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
          <h2 className="mb-2 font-display text-lg font-medium">15. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes
            will be reflected by an updated &quot;last updated&quot; date on
            this page.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">16. Contact</h2>
          <p>
            Questions about this policy can be sent to{" "}
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>
            .
          </p>
        </section>
      </div>
      </div>
    </main>
  );
}

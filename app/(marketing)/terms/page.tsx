import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing use of the LinkLazy marketplace.",
};

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Terms &amp; Conditions</h1>
      <p className="mb-8 text-sm text-muted">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="space-y-6 text-sm leading-7 text-ink">
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">1. Acceptance of terms</h2>
          <p>
            By creating an account or using LinkLazy, you agree to these
            Terms &amp; Conditions. If you don&apos;t agree, please don&apos;t
            use the platform.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">2. What LinkLazy is</h2>
          <p>
            LinkLazy is a marketplace connecting site owners (sellers) with
            buyers seeking backlink placements, through either a paid order
            or a reciprocal link exchange. We facilitate the transaction and
            provide escrow-style payment holding, but we are not a party to
            the underlying agreement between buyer and seller beyond
            enforcing these terms.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">3. Listing accuracy</h2>
          <p>
            Sellers must submit accurate site metrics and complete our
            ownership verification process. Submitting fabricated or
            materially misleading metrics is grounds for listing removal and
            account suspension.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">4. Prohibited content and conduct</h2>
          <p>
            You may not use LinkLazy to exchange or sell links involving
            illegal content, content that violates applicable search engine
            guidelines in a way intended to deceive users, or content that is
            adult, gambling-related, or otherwise prohibited by a seller&apos;s
            stated content guidelines. Attempting to bypass in-platform
            payments or move transactions off-platform to avoid fees is
            prohibited.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">5. Payments, commission, and escrow</h2>
          <p>
            For paid orders, buyer funds are held until the buyer confirms
            successful delivery, after which funds are released to the
            seller minus the applicable platform commission. Sellers on a
            monthly subscription plan may be subject to different commission
            terms as described on our pricing page. Fees and commission
            rates may change with notice.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">6. Referral program</h2>
          <p>
            Users may earn a commission credit — currently 50% of LinkLazy's
            commission on a referred user's completed paid orders — by
            referring new users with their unique referral link. Referral
            credits are informational account balances until a withdrawal
            process is made available; LinkLazy reserves the right to adjust
            the referral commission rate, and to withhold or reverse credits
            found to result from fraudulent, self-referred, or abusive
            signups.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">7. Disputes</h2>
          <p>
            If a buyer and seller cannot resolve an issue directly through
            in-platform messaging, either party may open a dispute for admin
            review. Our decision on a dispute, made in good faith based on
            the evidence provided, is final for the purposes of releasing or
            refunding escrowed funds.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">8. Account suspension</h2>
          <p>
            We may suspend or terminate accounts that violate these terms,
            submit fraudulent listings, repeatedly fail to deliver on orders,
            or attempt to circumvent platform fees or safety features.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">9. Limitation of liability</h2>
          <p>
            LinkLazy is provided &quot;as is.&quot; We are not liable for any
            indirect, incidental, or consequential damages arising from your
            use of the platform, including changes in search engine rankings
            or traffic resulting from links exchanged or purchased through
            the marketplace.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">10. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. Continued use of
            the platform after changes take effect constitutes acceptance of
            the updated terms.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">11. Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
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

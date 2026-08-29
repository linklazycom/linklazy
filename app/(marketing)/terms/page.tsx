import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing use of the LinkLazy marketplace.",
};

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main>
      <PageHero
        eyebrow="Legal"
        eyebrowIcon={FileText}
        title="Terms & Conditions"
        description={`Last updated: ${new Date().toLocaleDateString()}`}
      />

      <div className="mx-auto max-w-2xl px-6 py-16">
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
            We currently support payment via bKash and PayPal. For flat-fee
            paid orders, buyer funds are held until the buyer confirms
            successful delivery, after which funds are released to the
            seller minus the applicable platform commission. Commission is
            tiered by each seller&apos;s cumulative sales within the
            calendar month — 20% by default, dropping to 15% past ৳500 and
            10% past ৳1,000 in released sales that month, resetting at the
            start of each month. Fees and commission rates may change with
            notice.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">6. Pay-Per-View orders and wallet balance</h2>
          <p>
            Some listings support Pay-Per-View (PPV) pricing, where payment
            is deducted incrementally from a buyer&apos;s prepaid wallet balance
            as verified views accrue against the linked content, up to a
            budget cap the buyer sets at order time. Wallet funds are
            prepaid and buyer-owned until spent; unspent wallet balance
            remains available for future orders. Seller earnings from PPV
            orders are subject to a payout hold period before becoming
            eligible for withdrawal, during which we may review view data
            for signs of fraudulent or artificially inflated traffic.
            LinkLazy reserves the right to withhold or reverse PPV earnings
            found to result from invalid, bot-driven, or manipulated view
            activity.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">7. Referral program</h2>
          <p>
            Users may earn a commission credit — currently 50% of LinkLazy&apos;s
            commission on a referred user&apos;s completed paid orders — by
            referring new users with their unique referral link. Referral
            credits are informational account balances until a withdrawal
            process is made available; LinkLazy reserves the right to adjust
            the referral commission rate, and to withhold or reverse credits
            found to result from fraudulent, self-referred, or abusive
            signups.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">8. Disputes</h2>
          <p>
            If a buyer and seller cannot resolve an issue directly through
            in-platform messaging, either party may open a dispute for admin
            review. Our decision on a dispute, made in good faith based on
            the evidence provided, is final for the purposes of releasing or
            refunding escrowed funds.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">9. Account suspension</h2>
          <p>
            We may suspend or terminate accounts that violate these terms,
            submit fraudulent listings, repeatedly fail to deliver on orders,
            or attempt to circumvent platform fees or safety features.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">10. Limitation of liability</h2>
          <p>
            LinkLazy is provided &quot;as is.&quot; We are not liable for any
            indirect, incidental, or consequential damages arising from your
            use of the platform, including changes in search engine rankings
            or traffic resulting from links exchanged or purchased through
            the marketplace. Where we display verified metrics (such as
            Domain Rating sourced from a third-party provider), verification
            confirms the metric was retrieved from that provider at the time
            shown — it is not a guarantee of ranking outcomes, traffic, or
            any other result from a link placement.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">11. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. Continued use of
            the platform after changes take effect constitutes acceptance of
            the updated terms.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">12. Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
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

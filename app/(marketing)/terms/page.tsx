import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms & Conditions",
  description: "The terms governing use of the LinkLazy marketplace.",
};

/** Update this date whenever the text changes (it used to show today's date on every visit, which is misleading for legal text). */
const LEGAL_UPDATED = "30 October 2026";

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const email = settings.contact_email as string;

  return (
    <main>
      <PageHero
        eyebrow="Legal"
        eyebrowIcon={FileText}
        title="Terms & Conditions"
        description={`Last updated: ${LEGAL_UPDATED}`}
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
            calendar month — 20% by default, dropping to 15% past $500 and
            10% past $1,000 in released sales that month, resetting at the
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
          <h2 className="mb-2 font-display text-lg font-medium">7. Wallet, deposit bonus and withdrawals</h2>
          <p>
            You can add money to your LinkLazy wallet using the payment methods we offer (currently PayPal and bKash) and use it for orders and paid tools on the platform. We may offer a deposit bonus on top-ups. A bonus is wallet credit that can be spent on LinkLazy but cannot be withdrawn; when you spend from your wallet, any unspent bonus is used first. If a top-up is refunded or reversed, we may take back the part of its bonus that has not been spent.
          </p>
          <p>
            You may ask to withdraw your earnings and referral credit to bKash, Nagad or a bank account. Every request is reviewed by our team and paid manually, so payouts are not instant. We may delay or reject a request that looks fraudulent or breaks these terms; a rejected amount returns to your balance. You are responsible for entering correct payout details, and we are not liable for a payout sent to the details you gave us.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">8. Refunds and cancellations</h2>
          <p>
            When a paid order is rejected by the seller, cancelled before the seller accepts it, or resolved in the buyer&apos;s favour through a dispute, the escrowed amount is returned to the buyer&apos;s LinkLazy wallet. Escrowed funds are released to the seller when the buyer accepts delivery or as otherwise provided in these terms.
          </p>
          <p>
            Money added to the wallet is meant to be used on LinkLazy. If you want a refund of an unused top-up, contact support and we will review it case by case; fees charged by payment providers may not be refundable. If a paid tool fails to produce a result, the charge for that use is refunded to your wallet.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">9. Referral program</h2>
          <p>
            Users may earn a commission credit — currently 50% of LinkLazy&apos;s
            commission on a referred user&apos;s completed paid orders — by
            referring new users with their unique referral link. Referral
            credits can be withdrawn through the withdrawal process
            described above, once reviewed by our team; LinkLazy reserves the right to adjust
            the referral commission rate, and to withhold or reverse credits
            found to result from fraudulent, self-referred, or abusive
            signups.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">10. Short links and acceptable use</h2>
          <p>
            LinkLazy offers a short-link service. You may not use it to point to phishing pages, malware, scams, illegal content, content that exploits children, or anything that misleads people about where a link goes. Anyone can report a link from our Report a link page. We may turn off a link or limit link features at any time, with or without notice, and we may flag or suspend accounts that abuse the service. If an account is suspended or banned, its short links are turned off too. Links with a password, expiry date or click limit behave as you set them, and we may apply usage limits to accounts.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">11. AI-assisted tools</h2>
          <p>
            Some LinkLazy tools use artificial intelligence to draft or suggest text, images or ideas. Results can be wrong, incomplete or similar to other content, so you must review them before use and you are responsible for how you use them, including making sure they follow these terms and the law. Do not enter passwords, secrets or other people&apos;s personal data into these tools. What you enter may be sent to third-party AI providers in order to produce the result.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">12. Press release service</h2>
          <p>
            If you order a press release, you must give us accurate information that you have the right to publish. We review every request and may decline it or ask for changes. Payment arrangements are confirmed by our team before work starts. Delivery times we show are estimates, not guarantees. We pass your release to media and publishing partners, but we cannot control whether, or for how long, a third-party site keeps an article online, or what effect it has on search rankings.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">13. Disputes</h2>
          <p>
            If a buyer and seller cannot resolve an issue directly through
            in-platform messaging, either party may open a dispute for admin
            review. Our decision on a dispute, made in good faith based on
            the evidence provided, is final for the purposes of releasing or
            refunding escrowed funds.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">14. Account suspension</h2>
          <p>
            We may suspend or terminate accounts that violate these terms,
            submit fraudulent listings, repeatedly fail to deliver on orders,
            or attempt to circumvent platform fees or safety features.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">15. Limitation of liability</h2>
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
          <h2 className="mb-2 font-display text-lg font-medium">16. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. Continued use of
            the platform after changes take effect constitutes acceptance of
            the updated terms.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-medium">17. Contact</h2>
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

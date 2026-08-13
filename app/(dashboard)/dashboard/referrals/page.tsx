import { createClient } from "@/lib/supabase/server";
import { MetricChip } from "@/components/ui/metric-chip";
import { ReferralLinkBox } from "@/components/dashboard/referral-link-box";

export default async function ReferralsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();

  const { data: credits } = await supabase
    .from("referral_credits")
    .select("id, amount, created_at, order_id")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false });

  const totalEarned = (credits ?? []).reduce((sum, c) => sum + c.amount, 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const referralLink = `${siteUrl}/register?ref=${profile?.referral_code ?? ""}`;

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Referrals</h1>
      <p className="mb-6 text-sm text-muted">
        Earn 50% of LinkLazy's commission every time someone you refer
        completes a paid order, credited automatically to your account.
      </p>

      <div className="mb-6">
        <ReferralLinkBox link={referralLink} />
      </div>

      <div className="mb-6 flex gap-2">
        <MetricChip label="Total earned" value={`৳${totalEarned}`} tone="verified" />
        <MetricChip label="Referral credits" value={credits?.length ?? 0} />
      </div>

      <div className="rounded-chip border border-line bg-white p-5">
        <p className="mb-3 text-sm font-medium">Credit history</p>
        {!credits?.length && (
          <p className="text-sm text-muted">
            No credits yet — share your link above to start earning.
          </p>
        )}
        <ul className="divide-y divide-line">
          {credits?.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted">
                {new Date(c.created_at).toLocaleDateString()} — order {c.order_id.slice(0, 8)}
              </span>
              <span className="font-medium">৳{c.amount}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-xs text-muted">
        Credits accumulate here as a running total. Redeeming them against
        your billing isn't wired up yet — flag it and we'll connect this to
        the billing flow next.
      </p>
    </div>
  );
}

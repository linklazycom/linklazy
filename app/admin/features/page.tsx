import Link from "next/link";
import { getFlags } from "@/lib/feature-flags";
import { FeatureToggle } from "@/components/admin/feature-toggle";
import { TOOLS, TOOL_FLAG_KEYS, type ToolGroup } from "@/lib/features/registry";

export const metadata = { title: "Admin · Tools & features" };
export const dynamic = "force-dynamic";

const GROUPS: ToolGroup[] = ["SEO workspace", "Link tools"];

export default async function AdminFeaturesPage() {
  const flags = await getFlags(TOOL_FLAG_KEYS);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Tools &amp; features</h1>
        <p className="text-sm text-muted">
          ব্যবহারকারীদের জন্য টুলগুলোর তালিকা: প্রতিটি কী করে, কেন আছে, কীভাবে ব্যবহার হয়, আর আপনি ইচ্ছামতো ON/OFF করতে পারেন। বন্ধ করলে টুলটি ব্যবহারকারীদের সাইডবার থেকে সরে যায় এবং পেজ ও API ব্যবহারকারীদের জন্য বন্ধ হয়; ব্যবহারকারীর সংরক্ষিত কিছু মোছা হয় না; অ্যাডমিন নিজে খুলে পরীক্ষা করতে পারেন। পরিবর্তন প্রায় ১৫ সেকেন্ডে সবার কাছে পৌঁছায়।
        </p>
        <p className="mt-1 text-xs text-muted">
          এই টুলগুলো ব্যবহারকারীর <Link href="/dashboard" className="underline">Dashboard</Link>-এ থাকে (অ্যাডমিন একই অ্যাকাউন্টে সেখানে গিয়ে ব্যবহার করতে পারেন)। মার্কেটপ্লেসের মূল অংশ (কেনা-বেচা, ওয়ালেট, অর্ডার, সাপোর্ট) এখানে নেই, ইচ্ছা করেই।
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="font-display text-lg font-medium">{group}</h2>
          {TOOLS.filter((t) => t.group === group).map((t) => {
            const on = flags[t.flagKey] !== false;
            return (
              <article key={t.id} className="rounded-chip border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 max-w-2xl">
                    <h3 className="font-medium">{t.label} <span className={`ml-1 rounded-chip px-2 py-0.5 text-xs ${on ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{on ? "ON" : "OFF"}</span></h3>
                    <p className="mt-1 text-sm">{t.what}</p>
                  </div>
                  <FeatureToggle id={t.id} label={t.label} enabled={on} />
                </div>

                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium">কেন আছে, কীভাবে ব্যবহার হয়, আপনার করণীয়</summary>
                  <div className="mt-2 space-y-3 text-muted">
                    <p><strong className="text-ink">কেন দরকার:</strong> {t.why}</p>
                    <div>
                      <strong className="text-ink">ব্যবহারকারী কীভাবে ব্যবহার করে:</strong>
                      <ol className="list-decimal pl-5">{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                    </div>
                    <div>
                      <strong className="text-ink">অ্যাডমিন হিসেবে আপনার জানার বিষয়:</strong>
                      <ul className="list-disc pl-5">{t.adminNotes.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                    <p><strong className="text-ink">বন্ধ করলে কী হয়:</strong> {t.whenOff}</p>
                  </div>
                </details>

                <p className="mt-3 flex flex-wrap gap-4 text-xs">
                  <Link href={t.userHref} className="underline">ব্যবহারকারীর পেজটি খুলুন</Link>
                  {t.adminHref && <Link href={t.adminHref} className="underline">সংশ্লিষ্ট অ্যাডমিন পেজ</Link>}
                </p>
              </article>
            );
          })}
        </section>
      ))}

      <p className="text-xs text-muted">
        আরও টুল (যেমন সাইট স্ক্যান, এক্সচেঞ্জ ম্যাচ, ওয়াচলিস্ট, প্রেস রিলিজ) পরের ব্যাচগুলোতে এই তালিকায় যোগ হবে, প্রতিটির ব্যাখ্যাসহ।
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { searchPexelsPhoto } from "@/lib/pexels";

export const metadata: Metadata = {
  title: "About",
  description: "Why we built LinkLazy — a vetted marketplace for backlink exchange.",
};

export default async function AboutPage() {
  const photo = await searchPexelsPhoto("team working office collaboration");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 font-display text-3xl font-medium">About LinkLazy</h1>

      {photo && (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-chip">
          <Image src={photo.url} alt={photo.alt} fill className="object-cover" unoptimized />
        </div>
      )}

      <div className="space-y-4 text-sm leading-7 text-ink">
        <p>
          Link building is one of the most time-consuming parts of SEO — and
          one of the easiest places to get scammed by inflated metrics, dead
          sites, or links that quietly disappear a week after you pay for
          them.
        </p>
        <p>
          LinkLazy exists to fix that. Every site on the platform goes
          through an ownership check before it&apos;s listed, metrics are
          shown transparently up front, and every order — whether it&apos;s a
          direct exchange or a paid placement — goes through a delivery and
          confirmation flow before money or links change hands.
        </p>
        <p>
          We&apos;re built for site owners and marketers who want link
          building to be straightforward: clear metrics, verified sellers,
          and a paper trail for every transaction.
        </p>
      </div>
    </main>
  );
}

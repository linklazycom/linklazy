import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PressReleaseOrderForm, type PressReleaseProduct } from "@/components/press-releases/press-release-order-form";

export const metadata = { title: "Press Release Distribution", description: "Distribute your announcement through curated news media packages." };

export default async function PressReleasesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("press_release_products").select("id, name, description, category, price_amount, outlet_count, domain_authority, monthly_visitors, featured").eq("active", true).order("sort_order");
  const products = (data ?? []) as PressReleaseProduct[];
  return <main className="overflow-hidden">
    <section className="relative isolate bg-ink px-6 py-20 text-white"><div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(44,117,252,.48),transparent_30%),radial-gradient(circle_at_85%_35%,rgba(178,60,252,.35),transparent_28%)]" /><div className="absolute inset-0 -z-10 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:36px_36px]" /><div className="mx-auto max-w-5xl"><div className="max-w-3xl"><p className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-[.16em] text-white/80">LINKLAZY PRESS ROOM</p><h1 className="font-display text-4xl font-medium leading-tight md:text-6xl">Make your next announcement impossible to miss.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-white/75 md:text-lg">Build a bespoke release campaign with respected media placements, professional editorial support, and a dedicated delivery team.</p></div><div className="mt-10 grid max-w-3xl grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-5"><div className="px-4 first:pl-0"><p className="font-mono text-xl">350+</p><p className="mt-1 text-xs text-white/60">Media outlets</p></div><div className="px-4"><p className="font-mono text-xl">48h</p><p className="mt-1 text-xs text-white/60">Review response</p></div><div className="px-4"><p className="font-mono text-xl">1:1</p><p className="mt-1 text-xs text-white/60">Campaign support</p></div></div></div></section>
    <section className="border-b border-line bg-white"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm"><p className="text-muted"><span className="mr-2 text-signal">●</span>Transparent packages. Human review before every submission.</p>{user ? <Link href="/dashboard/press-releases" className="font-medium text-brand-violet hover:underline">View my press releases →</Link> : <Link href="/login?redirect=/press-releases" className="font-medium text-brand-violet hover:underline">Log in to manage orders →</Link>}</div></section>
    <section className="mx-auto max-w-5xl px-6 py-14"><div className="mb-10 max-w-2xl"><p className="text-xs font-semibold tracking-[.16em] text-brand-violet">CAMPAIGN BUILDER</p><h2 className="mt-3 font-display text-3xl font-medium">Choose the reach your story deserves.</h2><p className="mt-3 text-sm leading-6 text-muted">Select your publishing and writing options below. Your package, total, and release brief stay together in one clear workflow.</p></div>
      {products.length ? <PressReleaseOrderForm products={products} /> : <div className="rounded-chip border border-amber/40 bg-amber-soft p-5 text-sm">Press release packages are being prepared. Please check back shortly.</div>}
    </section>
  </main>;
}

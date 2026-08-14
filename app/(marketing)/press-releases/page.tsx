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
  return <main>
    <section className="bg-brand-gradient px-6 py-16 text-center text-white"><div className="mx-auto max-w-3xl"><p className="mb-3 text-sm font-medium text-white/80">PRESS RELEASE DISTRIBUTION</p><h1 className="font-display text-4xl font-medium md:text-5xl">Put your story in front of the right audience.</h1><p className="mx-auto mt-4 max-w-2xl text-white/85">Choose trusted media placements and optional professional writing. Every request is reviewed before distribution.</p></div></section>
    <section className="mx-auto max-w-5xl px-6 py-12"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-2xl font-medium">Build your distribution package</h2><p className="mt-1 text-sm text-muted">Pick one or more outlets, then send us your release details.</p></div>{user ? <Link href="/dashboard/press-releases"><Button variant="secondary" size="sm">My press releases</Button></Link> : <Link href="/login?redirect=/press-releases"><Button size="sm">Log in to order</Button></Link>}</div>
      {products.length ? <PressReleaseOrderForm products={products} /> : <div className="rounded-chip border border-amber/40 bg-amber-soft p-5 text-sm">Press release packages are being prepared. Please check back shortly.</div>}
    </section>
  </main>;
}

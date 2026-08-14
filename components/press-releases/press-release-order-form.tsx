"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface PressReleaseProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_amount: number;
  outlet_count: number | null;
  domain_authority: number | null;
  monthly_visitors: string | null;
  featured: boolean;
}

export function PressReleaseOrderForm({ products }: { products: PressReleaseProduct[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(products.filter((p) => p.featured).map((p) => p.id));
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const total = useMemo(() => products.filter((p) => selected.includes(p.id)).reduce((sum, p) => sum + Number(p.price_amount), 0) * quantity, [products, selected, quantity]);
  const groups = ["Premium News Media", "Top-tier News Media", "Writing Packages"];

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function submit(form: HTMLFormElement) {
    if (!selected.length) return setError("Choose at least one publishing or writing option.");
    setSubmitting(true); setError(""); setMessage("");
    const formData = new FormData(form);
    const response = await fetch("/api/press-releases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      product_ids: selected, quantity, headline: formData.get("headline"), website_url: formData.get("website_url"),
      target_url: formData.get("target_url"), summary: formData.get("summary"), notes: formData.get("notes"),
    }) });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) return setError(typeof data.error === "string" ? data.error : "Please check the required fields and try again.");
    setMessage("Your press release request is in the review queue.");
    form.reset(); setSelected(products.filter((p) => p.featured).map((p) => p.id)); setQuantity(1);
    router.refresh();
  }

  return <form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }} className="space-y-7">
    {groups.map((group) => {
      const entries = products.filter((product) => product.category === group);
      if (!entries.length) return null;
      return <section key={group} className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_12px_32px_rgba(10,14,39,.04)]">
        <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-brand-soft to-white px-5 py-4"><div><p className="text-[10px] font-semibold tracking-[.15em] text-brand-violet">{group === "Writing Packages" ? "OPTIONAL EDITORIAL" : "DISTRIBUTION TIER"}</p><h2 className="mt-1 font-medium">{group}</h2></div><span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-muted">Choose any</span></div>
        <div className="space-y-3 p-4 md:p-5">
          {entries.map((product) => <label key={product.id} className={`group flex cursor-pointer gap-4 rounded-lg border p-4 transition-all ${selected.includes(product.id) ? "border-brand-violet bg-brand-soft/50 shadow-sm" : "border-line bg-white hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-sm"}`}>
            <input className="mt-1 h-4 w-4 accent-brand-violet" type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-medium">{product.name}{product.featured && <span className="rounded-full bg-signal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Popular</span>}</span>
              {product.description && <span className="mt-1 block text-sm text-muted">{product.description}</span>}
              <span className="mt-2 block text-xs text-muted">{product.outlet_count ? `${product.outlet_count}+ outlets` : "Writing service"}{product.domain_authority ? ` · DA ${product.domain_authority}+` : ""}{product.monthly_visitors ? ` · ${product.monthly_visitors} monthly visitors` : ""}</span>
            </span><span className="text-right"><span className="block font-mono text-sm font-medium">৳{Number(product.price_amount).toLocaleString()}</span><span className="mt-1 block text-[10px] uppercase tracking-wide text-muted">per release</span></span>
          </label>)}
        </div>
      </section>;
    })}
    <section className="rounded-xl border border-line bg-white p-5 shadow-[0_12px_32px_rgba(10,14,39,.04)]"><div className="mb-5"><p className="text-[10px] font-semibold tracking-[.15em] text-brand-violet">YOUR STORY</p><h2 className="mt-1 font-medium">Give our editorial team the essentials</h2></div><div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">Release headline<input required name="headline" maxLength={180} className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="Your newsworthy announcement" /></label>
      <label className="text-sm font-medium">Website URL<input required type="url" name="website_url" className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="https://yourwebsite.com" /></label>
      <label className="text-sm font-medium">Target URL<input required type="url" name="target_url" className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="https://yourwebsite.com/page" /></label>
      <label className="text-sm font-medium">Quantity<input min={1} max={25} type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" /></label>
      <label className="text-sm font-medium md:col-span-2">Brief / key details<textarea required name="summary" minLength={30} maxLength={2000} className="mt-1.5 min-h-28 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="Tell us the announcement, audience, key facts, and preferred tone." /></label>
      <label className="text-sm font-medium md:col-span-2">Additional notes <span className="font-normal text-muted">(optional)</span><textarea name="notes" maxLength={2000} className="mt-1.5 min-h-20 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="Brand guidelines, embargo, or other requirements" /></label></div>
    </section>
    {error && <p className="rounded-chip bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="rounded-chip bg-signal-soft p-3 text-sm text-signal">{message}</p>}
    <div className="sticky bottom-4 z-[1] flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink/10 bg-ink p-4 text-white shadow-xl"><span><span className="block text-[10px] font-semibold tracking-[.14em] text-white/55">CAMPAIGN ESTIMATE</span><span className="mt-1 block font-mono text-2xl font-medium">৳{total.toLocaleString()}</span><span className="mt-1 block text-xs text-white/60">{selected.length} option{selected.length === 1 ? "" : "s"} selected · reviewed before publishing</span></span><Button disabled={submitting || !selected.length} type="submit" className="bg-white text-ink hover:bg-white/90">{submitting ? "Sending request…" : "Send campaign request →"}</Button></div>
  </form>;
}

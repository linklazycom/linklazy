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

  return <form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }} className="space-y-6">
    {groups.map((group) => {
      const entries = products.filter((product) => product.category === group);
      if (!entries.length) return null;
      return <section key={group} className="rounded-chip border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-paper px-5 py-4"><h2 className="font-medium">{group}</h2><span className="text-xs text-muted">Select placements</span></div>
        <div className="space-y-3 p-4">
          {entries.map((product) => <label key={product.id} className="flex cursor-pointer gap-4 rounded-chip border border-line p-4 transition hover:border-brand-violet">
            <input className="mt-1 h-4 w-4 accent-brand-violet" type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-medium">{product.name}{product.featured && <span className="rounded bg-signal-soft px-2 py-0.5 text-xs text-signal">Popular</span>}</span>
              {product.description && <span className="mt-1 block text-sm text-muted">{product.description}</span>}
              <span className="mt-2 block text-xs text-muted">{product.outlet_count ? `${product.outlet_count}+ outlets` : "Writing service"}{product.domain_authority ? ` · DA ${product.domain_authority}+` : ""}{product.monthly_visitors ? ` · ${product.monthly_visitors} monthly visitors` : ""}</span>
            </span><span className="font-mono text-sm">৳{Number(product.price_amount).toLocaleString()}</span>
          </label>)}
        </div>
      </section>;
    })}
    <section className="grid gap-4 rounded-chip border border-line bg-white p-5 md:grid-cols-2">
      <label className="text-sm font-medium">Release headline<input required name="headline" maxLength={180} className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="Your newsworthy announcement" /></label>
      <label className="text-sm font-medium">Website URL<input required type="url" name="website_url" className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="https://yourwebsite.com" /></label>
      <label className="text-sm font-medium">Target URL<input required type="url" name="target_url" className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="https://yourwebsite.com/page" /></label>
      <label className="text-sm font-medium">Quantity<input min={1} max={25} type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="mt-1.5 w-full rounded-chip border border-line px-3 py-2 font-normal" /></label>
      <label className="text-sm font-medium md:col-span-2">Brief / key details<textarea required name="summary" minLength={30} maxLength={2000} className="mt-1.5 min-h-28 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="Tell us the announcement, audience, key facts, and preferred tone." /></label>
      <label className="text-sm font-medium md:col-span-2">Additional notes <span className="font-normal text-muted">(optional)</span><textarea name="notes" maxLength={2000} className="mt-1.5 min-h-20 w-full rounded-chip border border-line px-3 py-2 font-normal" placeholder="Brand guidelines, embargo, or other requirements" /></label>
    </section>
    {error && <p className="rounded-chip bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="rounded-chip bg-signal-soft p-3 text-sm text-signal">{message}</p>}
    <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-chip border border-line bg-white/95 p-4 shadow-sm backdrop-blur"><span><span className="block text-xs text-muted">Estimated total</span><span className="font-mono text-xl font-medium">৳{total.toLocaleString()}</span></span><Button disabled={submitting || !selected.length} type="submit">{submitting ? "Sending request…" : "Submit press release"}</Button></div>
  </form>;
}

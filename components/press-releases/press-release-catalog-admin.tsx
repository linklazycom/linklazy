"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Product = { id: string; name: string; description: string | null; category: string; price_amount: number; outlet_count: number | null; domain_authority: number | null; monthly_visitors: string | null; featured: boolean; active: boolean; sort_order: number };
type Draft = Omit<Product, "id">;
const blank: Draft = { name: "", description: "", category: "Premium News Media", price_amount: 0, outlet_count: null, domain_authority: null, monthly_visitors: "", featured: false, active: true, sort_order: 0 };

function nullableNumber(value: string) { return value === "" ? null : Number(value); }
function ProductForm({ value, onSave, saving, label }: { value: Draft; onSave: (data: Draft) => void; saving: boolean; label: string }) {
  const [draft, setDraft] = useState<Draft>(value);
  useEffect(() => setDraft(value), [value]);
  const set = <K extends keyof Draft>(key: K, next: Draft[K]) => setDraft((current) => ({ ...current, [key]: next }));
  return <form onSubmit={(e) => { e.preventDefault(); onSave(draft); }} className="grid gap-3 rounded-chip border border-line bg-paper p-4 md:grid-cols-2">
    <label className="text-xs text-muted">Package name<input required value={draft.name} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
    <label className="text-xs text-muted">Category<select value={draft.category} onChange={(e) => set("category", e.target.value)} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink"><option>Premium News Media</option><option>Top-tier News Media</option><option>Writing Packages</option></select></label>
    <label className="text-xs text-muted">Price (৳)<input required min="0" type="number" value={draft.price_amount} onChange={(e) => set("price_amount", Number(e.target.value))} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
    <label className="text-xs text-muted">Display order<input min="0" type="number" value={draft.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
    <label className="text-xs text-muted">Outlet count<input type="number" min="0" value={draft.outlet_count ?? ""} onChange={(e) => set("outlet_count", nullableNumber(e.target.value))} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
    <label className="text-xs text-muted">Domain authority<input type="number" min="0" max="100" value={draft.domain_authority ?? ""} onChange={(e) => set("domain_authority", nullableNumber(e.target.value))} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
    <label className="text-xs text-muted">Monthly visitors<input value={draft.monthly_visitors ?? ""} onChange={(e) => set("monthly_visitors", e.target.value || null)} placeholder="e.g. 3M+" className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
    <div className="flex items-end gap-5 pb-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /> Available</label></div>
    <label className="text-xs text-muted md:col-span-2">Feature description<textarea value={draft.description ?? ""} onChange={(e) => set("description", e.target.value || null)} maxLength={600} className="mt-1 min-h-20 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
    <div className="md:col-span-2"><Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : label}</Button></div>
  </form>;
}

export function PressReleaseCatalogAdmin() {
  const [products, setProducts] = useState<Product[]>([]); const [newOpen, setNewOpen] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function load() { const r = await fetch("/api/admin/press-releases/products"); if (r.ok) setProducts(await r.json()); else setMessage("Could not load the press release catalogue."); }
  useEffect(() => { load(); }, []);
  async function save(data: Draft, id?: string) { setSaving(true); setMessage(""); const r = await fetch(id ? `/api/admin/press-releases/products/${id}` : "/api/admin/press-releases/products", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); setSaving(false); if (!r.ok) return setMessage("Could not save the package. Check the fields and try again."); setNewOpen(false); setEditing(null); setMessage("Catalogue saved."); load(); }
  return <section className="mt-10"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-medium">Packages, price & features</h2><p className="mt-1 text-sm text-muted">Changes appear immediately on the Press Release order page.</p></div><Button size="sm" onClick={() => { setNewOpen((open) => !open); setEditing(null); }}>Add package</Button></div>{message && <p className="mb-3 text-sm text-muted">{message}</p>}{newOpen && <div className="mb-4"><ProductForm value={blank} onSave={(data) => save(data)} saving={saving} label="Create package" /></div>}<div className="space-y-3">{products.map((product) => <article key={product.id} className="rounded-chip border border-line bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{product.name}</h3><p className="mt-1 text-sm text-muted">{product.category} · ৳{Number(product.price_amount).toLocaleString()} · {product.active ? "Available" : "Hidden"}{product.featured ? " · Featured" : ""}</p></div><Button variant="secondary" size="sm" onClick={() => { setEditing(editing === product.id ? null : product.id); setNewOpen(false); }}>Edit</Button></div>{editing === product.id && <div className="mt-4"><ProductForm value={product} onSave={(data) => save(data, product.id)} saving={saving} label="Save changes" /></div>}</article>)}{!products.length && <p className="rounded-chip border border-line bg-white p-5 text-sm text-muted">No packages found yet.</p>}</div></section>;
}

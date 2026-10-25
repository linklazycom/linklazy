import { createClient } from "@/lib/supabase/server";

/**
 * Published testimonials (Batch 18). Shows nothing at all when there are none, so a young site never displays an empty or invented
 * "what people say" block. The database only returns testimonials that were published WITH the person's confirmed permission.
 */
export async function Testimonials({ limit = 6 }: { limit?: number }) {
  let rows: { id: string; author_name: string; author_role: string | null; author_site: string | null; quote: string }[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("testimonials").select("id, author_name, author_role, author_site, quote").eq("is_published", true).order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(limit);
    rows = (data ?? []) as typeof rows;
  } catch {
    return null;
  }
  if (rows.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="mb-5 font-display text-2xl font-medium tracking-tight">What people say</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id}>
            <figure className="h-full rounded-chip border border-line bg-white p-5">
              <blockquote className="text-[15px] leading-relaxed text-ink">“{r.quote}”</blockquote>
              <figcaption className="mt-3 text-sm text-muted">
                {r.author_name}
                {r.author_role ? `, ${r.author_role}` : ""}
                {r.author_site ? ` · ${r.author_site}` : ""}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

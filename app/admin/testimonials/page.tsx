import { createClient } from "@/lib/supabase/server";
import { TestimonialManager, type TestimonialRow } from "@/components/admin/testimonial-manager";

export const metadata = { title: "Admin · Testimonials" };
export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("id, author_name, author_role, author_site, quote, source_note, consent_confirmed, is_published, sort_order")
    .order("is_published", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Could not load testimonials. Has SQL 057 been run?");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Testimonials</h1>
        <p className="text-sm text-muted">
          সত্যিকারের ব্যবহারকারীদের মতামত, যা About পেজে দেখানো হয়। কোনো testimonial বানানো বা অনুমতি ছাড়া প্রকাশ করা যাবে না: প্রকাশ করতে হলে আগে “অনুমতি নিশ্চিত” টিক দিতে হয়, আর ডাটাবেসও অনুমতি ছাড়া প্রকাশ আটকায়। কোনোটি প্রকাশিত না থাকলে পাবলিক পেজে এই অংশ একেবারেই দেখানো হয় না।
        </p>
      </div>
      <TestimonialManager rows={(data ?? []) as TestimonialRow[]} />
    </div>
  );
}

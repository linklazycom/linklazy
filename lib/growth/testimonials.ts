/** Testimonial rules (Batch 18). Pure. A testimonial is shown to the public only with proof that the person agreed to it. */
export const QUOTE_MIN = 10;
export const QUOTE_MAX = 600;

export interface TestimonialInput {
  author_name: string;
  author_role: string | null;
  author_site: string | null;
  quote: string;
  source_note: string | null;
  consent_confirmed: boolean;
  is_published: boolean;
  sort_order: number;
}

export type TestimonialResult = { ok: true; value: TestimonialInput } | { ok: false; message: string; field?: string };

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max) : "");
const orNull = (s: string): string | null => (s ? s : null);

export function validateTestimonial(input: Record<string, unknown>): TestimonialResult {
  const author_name = clean(input.author_name, 80);
  if (!author_name) return { ok: false, message: "Enter the person's name.", field: "author_name" };
  const quote = clean(input.quote, QUOTE_MAX + 1);
  if (quote.length < QUOTE_MIN) return { ok: false, message: `The quote must be at least ${QUOTE_MIN} characters.`, field: "quote" };
  if (quote.length > QUOTE_MAX) return { ok: false, message: `The quote can be at most ${QUOTE_MAX} characters.`, field: "quote" };
  const consent_confirmed = input.consent_confirmed === true;
  const is_published = input.is_published === true;
  if (is_published && !consent_confirmed) return { ok: false, message: "Confirm that this person gave permission before publishing.", field: "consent_confirmed" };
  const sortRaw = Number(input.sort_order ?? 0);
  const sort_order = Number.isInteger(sortRaw) ? Math.max(-1000, Math.min(100000, sortRaw)) : 0;
  return {
    ok: true,
    value: {
      author_name,
      author_role: orNull(clean(input.author_role, 120)),
      author_site: orNull(clean(input.author_site, 200)),
      quote,
      source_note: orNull(clean(input.source_note, 300)),
      consent_confirmed,
      is_published,
      sort_order,
    },
  };
}

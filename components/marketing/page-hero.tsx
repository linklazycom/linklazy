import type { LucideIcon } from "lucide-react";

interface PageHeroProps {
  eyebrow: string;
  eyebrowIcon: LucideIcon;
  title: string;
  description?: string;
  /** Widen the two glow blobs' spread for pages with a longer title. */
  wide?: boolean;
}

/**
 * The shared hero treatment used across every marketing/info page
 * (home, browse, pricing, about, trust, terms, etc.) — a soft
 * brand-gradient glow behind an eyebrow badge, headline, and optional
 * description. Keeping this in one place is what makes every page read
 * as the same product rather than a stack of differently-styled pages.
 */
export function PageHero({ eyebrow, eyebrowIcon: Icon, title, description, wide = false }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-white text-center">
      <div className="pointer-events-none absolute inset-0">
        <div
          className={`absolute -top-16 left-1/4 rounded-full opacity-[0.12] blur-3xl ${
            wide ? "h-[340px] w-[340px]" : "h-[280px] w-[280px]"
          }`}
          style={{ background: "#2C75FC" }}
        />
        <div
          className={`absolute -top-10 right-1/4 rounded-full opacity-[0.12] blur-3xl ${
            wide ? "h-[320px] w-[320px]" : "h-[260px] w-[260px]"
          }`}
          style={{ background: "#B23CFC" }}
        />
      </div>
      <div className="relative mx-auto max-w-2xl px-6 py-16 md:py-20">
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-violet/20 bg-brand-soft px-3 py-1 font-mono text-xs uppercase tracking-widest text-brand-violet">
          <Icon className="h-3.5 w-3.5" />
          {eyebrow}
        </p>
        <h1 className="mb-3 font-display text-4xl font-medium tracking-tight">{title}</h1>
        {description && <p className="text-lg text-muted">{description}</p>}
      </div>
    </section>
  );
}

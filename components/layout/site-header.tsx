import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { NavLink } from "@/lib/site-settings";
import { CurrencyToggle } from "@/components/currency/currency-provider";
import { GlobalSearch } from "@/components/search/global-search";

// NOTE: breakpoint is `lg` (not `md`) here on purpose. Once the search box
// sits in this row alongside the logo, nav links, currency toggle, and two
// auth buttons, `md` (768px) is too narrow to fit everything without
// wrapping/overlapping. Below `lg` we collapse to the hamburger (MobileNav)
// instead, which also has its breakpoint set to `lg` to match.
export function SiteHeader({ navLinks }: { navLinks: NavLink[] }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <GlobalSearch browseHref="/browse" className="hidden max-w-[220px] lg:block" />

        <nav className="hidden shrink-0 items-center gap-5 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm text-muted hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          {!navLinks.some((link) => link.href === "/press-releases") && (
            <Link href="/press-releases" className="whitespace-nowrap text-sm text-muted hover:text-ink">
              Press releases
            </Link>
          )}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
          <CurrencyToggle />
          <Link href="/login" className="whitespace-nowrap text-sm text-muted hover:text-ink">
            Log in
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>

        <div className="ml-auto lg:hidden">
          <MobileNav navLinks={navLinks} />
        </div>
      </div>
    </header>
  );
}

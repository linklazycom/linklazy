import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import type { NavLink } from "@/lib/site-settings";

export function SiteFooter({
  footerLinks,
  contactEmail,
}: {
  footerLinks: Record<string, NavLink[]>;
  contactEmail: string;
}) {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 text-sm text-muted">
            A vetted marketplace for exchanging and buying backlinks between
            verified sites.
          </p>
          <a href={`mailto:${contactEmail}`} className="mt-3 block text-sm text-muted underline">
            {contactEmail}
          </a>
        </div>
        {Object.entries(footerLinks).map(([column, links]) => (
          <div key={column}>
            <p className="mb-3 text-sm font-medium">{column}</p>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-6 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} LinkLazy. All rights reserved.
      </div>
    </footer>
  );
}

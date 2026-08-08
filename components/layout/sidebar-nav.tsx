"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard" || item.href === "/admin"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-chip px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-brand-soft font-medium text-brand-violet"
                : "text-ink hover:bg-paper"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

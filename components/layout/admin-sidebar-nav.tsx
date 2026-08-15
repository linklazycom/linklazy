"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  label: string;
}

export interface AdminNavGroup {
  label: string;
  href?: string; // optional link for the group header itself (e.g. "Overview" -> /admin)
  items: AdminNavItem[];
}

function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminSidebarNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {groups.map((group) => {
        const groupActive =
          (group.href && isActivePath(pathname, group.href)) ||
          group.items.some((item) => isActivePath(pathname, item.href));

        return (
          <details key={group.label} open={groupActive} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-chip px-3 py-2 text-sm font-medium text-ink hover:bg-paper">
              {group.href ? (
                <Link
                  href={group.href}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    groupActive && !group.items.some((i) => isActivePath(pathname, i.href))
                      ? "text-brand-violet"
                      : ""
                  )}
                >
                  {group.label}
                </Link>
              ) : (
                <span>{group.label}</span>
              )}
              <span className="text-xs text-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="ml-2 mt-1 space-y-1 border-l border-line pl-3">
              {group.items.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-chip px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-brand-soft font-medium text-brand-violet"
                        : "text-muted hover:bg-paper hover:text-ink"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

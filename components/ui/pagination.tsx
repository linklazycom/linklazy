import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Builds the href for a given page, keeping every other current query param
 * (filters, etc.) intact — so paging never resets an active filter. */
function pageHref(basePath: string, params: Record<string, string | undefined>, page: number): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || !value) continue;
    qs.set(key, value);
  }
  if (page > 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Compact page-number list with ellipses — always shows first, last,
 * current, and one neighbour on each side. */
function pageNumbers(current: number, total: number): (number | "…")[] {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  params,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
      <Link
        href={pageHref(basePath, params, Math.max(1, currentPage - 1))}
        aria-disabled={currentPage === 1}
        className={`flex h-9 w-9 items-center justify-center rounded-chip border border-line bg-white text-muted transition-colors ${
          currentPage === 1 ? "pointer-events-none opacity-40" : "hover:border-ink hover:text-ink"
        }`}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      {pageNumbers(currentPage, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={pageHref(basePath, params, p)}
            aria-current={p === currentPage ? "page" : undefined}
            className={`flex h-9 min-w-9 items-center justify-center rounded-chip border px-2.5 text-sm font-medium transition-colors ${
              p === currentPage
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink hover:border-ink"
            }`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={pageHref(basePath, params, Math.min(totalPages, currentPage + 1))}
        aria-disabled={currentPage === totalPages}
        className={`flex h-9 w-9 items-center justify-center rounded-chip border border-line bg-white text-muted transition-colors ${
          currentPage === totalPages ? "pointer-events-none opacity-40" : "hover:border-ink hover:text-ink"
        }`}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}

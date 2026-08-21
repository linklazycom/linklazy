import Link from "next/link";

interface PaginationProps {
  basePath: string; // e.g. "/blog" or "/blog/category/technology"
  currentPage: number;
  totalPages: number;
}

function pageHref(basePath: string, page: number) {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

// Builds a compact page list like [1, "…", 4, 5, 6, "…", 12] so we never
// render dozens of page links — keeps the DOM small and the control
// readable at any article count.
function buildPageList(current: number, total: number): (number | "…")[] {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({ basePath, currentPage, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageList = buildPageList(currentPage, totalPages);

  return (
    <nav aria-label="Blog pagination" className="mt-12 flex items-center justify-center gap-1.5">
      {currentPage > 1 ? (
        <Link
          href={pageHref(basePath, currentPage - 1)}
          rel="prev"
          className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-brand-violet"
        >
          ← Prev
        </Link>
      ) : (
        <span className="rounded-chip border border-line px-3 py-1.5 text-sm text-muted opacity-40">
          ← Prev
        </span>
      )}

      <div className="mx-1 flex items-center gap-1">
        {pageList.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={pageHref(basePath, p)}
              aria-current={p === currentPage ? "page" : undefined}
              className={`min-w-[2.25rem] rounded-chip border px-2.5 py-1.5 text-center text-sm ${
                p === currentPage
                  ? "border-brand-violet bg-brand-soft font-medium text-brand-violet"
                  : "border-line bg-white text-ink hover:border-brand-violet"
              }`}
            >
              {p}
            </Link>
          )
        )}
      </div>

      {currentPage < totalPages ? (
        <Link
          href={pageHref(basePath, currentPage + 1)}
          rel="next"
          className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-brand-violet"
        >
          Next →
        </Link>
      ) : (
        <span className="rounded-chip border border-line px-3 py-1.5 text-sm text-muted opacity-40">
          Next →
        </span>
      )}
    </nav>
  );
}

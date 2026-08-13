"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Shows a thin colored bar at the very top of the viewport the instant
 * a user clicks any internal <Link>/<a>, and hides it once the new route
 * has actually rendered. Fixes the "did my click even register?" problem
 * across dashboard, admin, and marketing pages — works everywhere this
 * component is mounted once, in the root layout.
 *
 * No extra npm dependency: listens for clicks on internal links (capture
 * phase, so it fires before Next's own navigation), then clears itself
 * when the pathname/search params actually change.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // Ignore new-tab / modified clicks and external/mailto/tel links
      if (
        anchor.target === "_blank" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      setActive(true);
      // Safety timeout in case a navigation is cancelled or errors out —
      // never leave the bar stuck on-screen.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setActive(false), 4000);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  // Route actually changed (or finished rendering) — clear the bar.
  useEffect(() => {
    setActive(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [pathname, searchParams]);

  if (!active) return null;

  return (
    <div className="fixed left-0 top-0 z-[200] h-[3px] w-full overflow-hidden bg-transparent">
      <div className="h-full w-1/3 animate-nav-progress bg-brand-gradient" />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function WatchlistButton({ siteId, className }: { siteId: string; className?: string }) {
  const supabase = createClient();
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("watchlists")
        .select("id")
        .eq("user_id", user.id)
        .eq("site_id", siteId)
        .maybeSingle();
      setWatching(Boolean(data));
      setLoading(false);
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/watchlist/${siteId}`, {
      method: watching ? "DELETE" : "POST",
    });
    if (res.ok) setWatching(!watching);
    setBusy(false);
  }

  if (loading) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border px-2 py-1 text-xs transition-colors",
        watching
          ? "border-brand-violet/30 bg-brand-soft text-brand-violet"
          : "border-line bg-white text-muted hover:text-ink",
        className
      )}
      aria-pressed={watching}
    >
      <span>{watching ? "♥" : "♡"}</span>
      {watching ? "Watching" : "Watch"}
    </button>
  );
}

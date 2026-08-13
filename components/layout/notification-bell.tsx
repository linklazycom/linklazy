"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: "order" | "match" | "review" | "message";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) ?? []);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open && unreadCount > 0) {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-chip border border-line bg-white"
      >
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 1C5.5 1 3.5 3 3.5 5.5V8.5L2 12H14L12.5 8.5V5.5C12.5 3 10.5 1 8 1Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M6 14.5C6.3 15.6 7.1 16.5 8 16.5C8.9 16.5 9.7 15.6 10 14.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 max-h-96 w-80 overflow-y-auto rounded-chip border border-line bg-white shadow-lg">
            <div className="border-b border-line px-4 py-3 text-sm font-medium">Notifications</div>
            {!notifications.length && (
              <p className="px-4 py-6 text-center text-sm text-muted">No notifications yet.</p>
            )}
            <ul className="divide-y divide-line">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 text-sm hover:bg-paper ${!n.read ? "bg-brand-soft" : ""}`}
                  >
                    <p className="font-medium text-ink">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted line-clamp-2">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

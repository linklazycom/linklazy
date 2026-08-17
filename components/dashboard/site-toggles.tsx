"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ToggleDef {
  key: "maintenance_mode" | "signup_open";
  label: string;
  description: string;
  /** The setting's "value" string that means the toggle is ON/active. */
  onValue: string;
  offValue: string;
  /** Whether ON should render as green (safe) or amber (caution). */
  tone: "safe" | "caution";
}

const TOGGLES: ToggleDef[] = [
  {
    key: "maintenance_mode",
    label: "Maintenance mode",
    description:
      "যখন চালু থাকবে, পুরো সাইট ভিজিটরদের জন্য একটা মেইনটেন্যান্স পেজ দেখাবে — শুধু অ্যাডমিন লগইন করা থাকলে সাইট স্বাভাবিকভাবে দেখতে পাবেন।",
    onValue: "on",
    offValue: "off",
    tone: "caution",
  },
  {
    key: "signup_open",
    label: "New signups",
    description:
      "বন্ধ করলে /register পেজে নতুন অ্যাকাউন্ট খোলা যাবে না — বিদ্যমান ইউজাররা লগইন করতে পারবেন যথারীতি।",
    onValue: "on",
    offValue: "off",
    tone: "safe",
  },
];

export function SiteToggles() {
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", TOGGLES.map((t) => t.key));

      const map: Record<string, string> = {
        maintenance_mode: "off",
        signup_open: "on",
      };
      for (const row of data ?? []) {
        map[row.key] = typeof row.value === "string" ? row.value : String(row.value);
      }
      setValues(map);
      setLoaded(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(toggle: ToggleDef) {
    const isOn = values[toggle.key] === toggle.onValue;
    const nextValue = isOn ? toggle.offValue : toggle.onValue;

    setSaving(toggle.key);
    // Optimistic update so the switch feels instant.
    setValues((v) => ({ ...v, [toggle.key]: nextValue }));

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: toggle.key, value: nextValue }),
    });

    if (!res.ok) {
      // Revert on failure.
      setValues((v) => ({ ...v, [toggle.key]: isOn ? toggle.onValue : toggle.offValue }));
    }
    setSaving(null);
  }

  if (!loaded) return null;

  return (
    <div className="mb-10 rounded-chip border border-line bg-white p-5">
      <h2 className="mb-1 font-display text-lg font-medium">Site controls</h2>
      <p className="mb-4 text-sm text-muted">
        তাৎক্ষণিক এফেক্ট — টগল করলেই সাইটে সাথে সাথে প্রয়োগ হবে, কোনো ডিপ্লয় লাগবে না।
      </p>

      <div className="divide-y divide-line">
        {TOGGLES.map((toggle) => {
          const isOn = values[toggle.key] === toggle.onValue;
          return (
            <div key={toggle.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{toggle.label}</p>
                <p className="mt-0.5 text-xs text-muted">{toggle.description}</p>
                {isOn && toggle.tone === "caution" && (
                  <p className="mt-1.5 text-xs font-medium text-amber">
                    ⚠ এখন চালু আছে — ভিজিটররা সাইট দেখতে পারছেন না
                  </p>
                )}
                {!isOn && toggle.key === "signup_open" && (
                  <p className="mt-1.5 text-xs font-medium text-amber">
                    ⚠ এখন বন্ধ আছে — নতুন কেউ সাইনআপ করতে পারছেন না
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                disabled={saving === toggle.key}
                onClick={() => handleToggle(toggle)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
                  isOn ? "bg-signal" : "bg-line"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    isOn ? "translate-x-[22px]" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

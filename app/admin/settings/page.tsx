"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { NavLinksEditor } from "@/components/dashboard/nav-links-editor";
import { SiteToggles } from "@/components/dashboard/site-toggles";

const SIMPLE_STRING_KEYS = [
  { key: "bdt_per_usd", label: "BDT per USD exchange rate", placeholder: "125" },
  { key: "contact_email", label: "Contact email" },
  { key: "ga_measurement_id", label: "Google Analytics 4 Measurement ID", placeholder: "G-XXXXXXX" },
  { key: "gsc_verification_code", label: "Google Search Console verification code", placeholder: "content value from the HTML tag method" },
  { key: "bing_verification_code", label: "Bing Webmaster Tools verification code" },
  { key: "pinterest_verification_code", label: "Pinterest domain verification code" },
  { key: "yandex_verification_code", label: "Yandex Webmaster verification code" },
  { key: "trust_starting_order_count", label: "Trust page — starting order count", placeholder: "0" },
  { key: "trust_starting_resolved_disputes_count", label: "Trust page — starting resolved-disputes count", placeholder: "0" },
];

interface NavLink {
  label: string;
  href: string;
}

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Browse Sites", href: "/browse" },
  { label: "Press releases", href: "/press-releases" },
  { label: "Niches", href: "/niches" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [navLinks, setNavLinks] = useState<NavLink[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [...SIMPLE_STRING_KEYS.map((k) => k.key), "nav_links"]);

      const map: Record<string, string> = {};
      let loadedNavLinks: NavLink[] | null = null;

      for (const row of data ?? []) {
        if (row.key === "nav_links") {
          loadedNavLinks = Array.isArray(row.value) ? (row.value as NavLink[]) : null;
        } else {
          map[row.key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
        }
      }

      setValues(map);
      setNavLinks(loadedNavLinks ?? DEFAULT_NAV_LINKS);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(key: string) {
    setSaving(key);
    setSaved(null);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: values[key] ?? "" }),
    });
    setSaving(null);
    setSaved(key);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-display text-2xl font-medium">Platform settings</h1>
      <p className="mb-8 text-sm text-muted">
        These verification codes get injected into the site&apos;s
        &lt;head&gt; on every page, so you can verify domain ownership with
        Google Search Console, Bing, Pinterest, and Yandex without touching
        code.
      </p>

      <SiteToggles />

      <div className="mb-10 rounded-chip border border-line bg-white p-5">
        <h2 className="mb-1 font-display text-lg font-medium">Navigation links</h2>
        <p className="mb-4 text-sm text-muted">
          Controls the header menu shown across the site. Changes apply
          immediately — no deploy needed.
        </p>
        {navLinks && <NavLinksEditor initialLinks={navLinks} />}
      </div>

      <div className="space-y-5">
        {SIMPLE_STRING_KEYS.map(({ key, label, placeholder }) => (
          <div key={key} className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                id={key}
                label={label}
                placeholder={placeholder}
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </div>
            <Button size="sm" onClick={() => handleSave(key)} disabled={saving === key}>
              {saving === key ? "Saving…" : saved === key ? "Saved" : "Save"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

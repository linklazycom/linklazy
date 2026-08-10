"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface Profile {
  full_name: string | null;
  bio: string | null;
  country: string | null;
  role: string;
  seller_tier: string | null;
  buyer_plan: string;
}

export default function ProfilePage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setEmail(user?.email ?? "");

    const { data } = await supabase
      .from("profiles")
      .select("full_name, bio, country, role, seller_tier, buyer_plan")
      .eq("id", user!.id)
      .single();
    setProfile(data as Profile);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.get("full_name"),
        bio: form.get("bio") || undefined,
        country: form.get("country") || undefined,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not save.");
      return;
    }
    setSaved(true);
    load();
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    setPasswordMsg(error ? error.message : "Password updated.");
    if (!error) setNewPassword("");
  }

  async function becomeSeller() {
    const nextRole = profile?.role === "buyer" ? "both" : profile?.role === "seller" ? "both" : profile?.role;
    if (!nextRole) return;
    await supabase.from("profiles").update({ role: nextRole }).eq("id", (await supabase.auth.getUser()).data.user!.id);
    load();
  }

  if (!profile) return <p className="text-muted">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-medium">Profile</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <MetricChip label="Role" value={profile.role} />
        {profile.seller_tier && profile.seller_tier !== "unranked" && (
          <MetricChip label="Seller tier" value={profile.seller_tier} tone="verified" />
        )}
        <MetricChip label="Buyer plan" value={profile.buyer_plan} />
      </div>

      {profile.role !== "both" && (
        <div className="mb-6 rounded-chip border border-line bg-white p-4 text-sm">
          <p className="mb-2 text-muted">
            {profile.role === "buyer"
              ? "Want to list a site and sell backlinks too?"
              : "Want to browse and buy backlinks too?"}
          </p>
          <Button size="sm" variant="secondary" onClick={becomeSeller}>
            {profile.role === "buyer" ? "Become a seller" : "Become a buyer"}
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mb-8 space-y-4 rounded-chip border border-line bg-white p-5">
        <h2 className="text-sm font-medium">Account details</h2>
        <Field id="email" label="Email" value={email} disabled />
        <Field id="full_name" name="full_name" label="Full name" defaultValue={profile.full_name ?? ""} required />
        <Field id="country" name="country" label="Country" defaultValue={profile.country ?? ""} />
        <div>
          <label htmlFor="bio" className="mb-1 block text-sm text-muted">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            defaultValue={profile.bio ?? ""}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-brand-violet"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-signal">Saved.</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <form onSubmit={handlePasswordChange} className="space-y-4 rounded-chip border border-line bg-white p-5">
        <h2 className="text-sm font-medium">Change password</h2>
        <Field
          id="new_password"
          type="password"
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
        {passwordMsg && (
          <p className={`text-sm ${passwordMsg === "Password updated." ? "text-signal" : "text-red-600"}`}>
            {passwordMsg}
          </p>
        )}
        <Button type="submit" variant="secondary" disabled={passwordSaving}>
          {passwordSaving ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

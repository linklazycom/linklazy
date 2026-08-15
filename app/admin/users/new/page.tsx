"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function NewUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("buyer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, role }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Could not create user.");
      return;
    }
    setResult({ tempPassword: body.tempPassword });
  }

  if (result) {
    return (
      <div className="max-w-md">
        <h1 className="mb-4 font-display text-2xl font-medium">User created</h1>
        <p className="mb-4 text-sm text-muted">
          Share this temporary password with {fullName || email} — they can log in immediately and
          should change it from their account settings. This is shown only once.
        </p>
        <div className="mb-6 rounded-chip border border-line bg-canvas p-4">
          <p className="text-xs text-muted">Email</p>
          <p className="mb-2 font-mono text-sm">{email}</p>
          <p className="text-xs text-muted">Temporary password</p>
          <p className="font-mono text-sm">{result.tempPassword}</p>
        </div>
        <Button onClick={() => router.push("/admin/users")}>Back to users</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 font-display text-2xl font-medium">Create user</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          id="full_name"
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <div>
          <label htmlFor="role" className="mb-1 block text-sm text-muted">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm"
          >
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="both">Both</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create user"}
        </Button>
      </form>
    </div>
  );
}

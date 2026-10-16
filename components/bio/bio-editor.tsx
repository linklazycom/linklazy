"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/links/copy-button";
import { BioView } from "@/components/bio/bio-view";
import { apiRequest } from "@/components/links/api";
import { BIO_THEMES } from "@/lib/bio/themes";

export interface EditorBioLink {
  id: string;
  title: string;
  url: string;
  is_active: boolean;
  click_count: number;
}

export interface EditorBioPage {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  is_published: boolean;
  view_count: number;
  locked: boolean; // taken down by admin / owner banned
}

export function BioEditor({ page, initialLinks, siteUrl }: { page: EditorBioPage; initialLinks: EditorBioLink[]; siteUrl: string }) {
  const [name, setName] = useState(page.display_name);
  const [bio, setBio] = useState(page.bio ?? "");
  const [avatar, setAvatar] = useState(page.avatar_url ?? "");
  const [theme, setTheme] = useState(page.theme);
  const [published, setPublished] = useState(page.is_published);
  const [links, setLinks] = useState(initialLinks);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const publicUrl = `${siteUrl}/bio/${page.slug}`;

  async function savePage(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await apiRequest(`/api/bio/${page.id}`, "PATCH", {
      display_name: name,
      bio: bio || null,
      avatar_url: avatar || null,
      theme,
      is_published: published,
    });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved ✓" } : { ok: false, text: res.error ?? "Could not save." });
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(null);
    const res = await apiRequest(`/api/bio/${page.id}/links`, "POST", { title: newTitle, url: newUrl });
    if (!res.ok) return setLinkError(res.error);
    setLinks((l) => [...l, res.data?.link as EditorBioLink]);
    setNewTitle("");
    setNewUrl("");
  }

  async function saveLink(l: EditorBioLink) {
    setLinkError(null);
    const res = await apiRequest(`/api/bio/${page.id}/links/${l.id}`, "PATCH", { title: l.title, url: l.url, is_active: l.is_active });
    if (!res.ok) return setLinkError(res.error);
    const saved = res.data?.link as EditorBioLink;
    setLinks((all) => all.map((x) => (x.id === l.id ? saved : x)));
  }

  async function removeLink(id: string) {
    if (!window.confirm("Delete this link?")) return;
    setLinkError(null);
    const res = await apiRequest(`/api/bio/${page.id}/links/${id}`, "DELETE");
    if (!res.ok) return setLinkError(res.error);
    setLinks((all) => all.filter((x) => x.id !== id));
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= links.length) return;
    const next = [...links];
    [next[index], next[j]] = [next[j], next[index]];
    setLinks(next);
    setLinkError(null);
    const res = await apiRequest(`/api/bio/${page.id}/links`, "PATCH", { ids: next.map((x) => x.id) });
    if (!res.ok) {
      setLinks(links);
      setLinkError(res.error);
    }
  }

  const edit = (id: string, patch: Partial<EditorBioLink>) => setLinks((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <form onSubmit={savePage} className="space-y-4 rounded-chip border border-line bg-white p-5">
          <h2 className="font-display text-lg font-medium">Profile</h2>
          <Field id="display_name" label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm text-muted">
              Short bio (plain text, up to 300 characters)
            </label>
            <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
          </div>
          <Field id="avatar" label="Avatar image URL (optional)" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} hint="A public https image link." />
          <div>
            <p className="mb-2 text-sm text-muted">Theme</p>
            <div className="flex flex-wrap gap-2">
              {BIO_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-2 rounded-chip border px-3 py-1.5 text-xs ${theme === t.id ? "border-ink" : "border-line"}`}
                >
                  <span className="inline-block h-4 w-4 rounded-full border border-line" style={{ background: t.bg }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {!page.locked && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Published (visible to everyone at the address below)
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Button>
            {msg && <span className={`text-sm ${msg.ok ? "text-signal" : "text-red-600"}`}>{msg.text}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="break-all font-mono">{publicUrl}</span>
            <CopyButton text={publicUrl} />
            <span>{page.view_count} views</span>
          </div>
        </form>

        <div className="space-y-4 rounded-chip border border-line bg-white p-5">
          <h2 className="font-display text-lg font-medium">Links</h2>
          <ul className="space-y-3">
            {links.map((l, i) => (
              <li key={l.id} className="space-y-2 rounded-chip border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={l.title} onChange={(e) => edit(l.id, { title: e.target.value })} maxLength={80} aria-label="Link title" className="rounded-chip border border-line px-3 py-1.5 text-sm" />
                  <input value={l.url} onChange={(e) => edit(l.id, { url: e.target.value })} aria-label="Link URL" className="rounded-chip border border-line px-3 py-1.5 text-sm" />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={l.is_active} onChange={(e) => edit(l.id, { is_active: e.target.checked })} /> Visible
                  </label>
                  <span className="text-muted">{l.click_count} clicks</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => saveLink(l)}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === links.length - 1} aria-label="Move down">
                    ↓
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeLink(l.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
            {links.length === 0 && <li className="text-sm text-muted">No links yet. Add your first one below.</li>}
          </ul>

          <form onSubmit={addLink} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field id="new_title" label="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={80} required />
            <Field id="new_url" label="URL" placeholder="https://…" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} required />
            <Button type="submit">Add link</Button>
          </form>
          {linkError && <p className="text-sm text-red-600">{linkError}</p>}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs text-muted">Live preview (unsaved changes show here)</p>
        <div className="flex h-[560px] overflow-y-auto rounded-[28px] border-4 border-ink">
          <BioView
            displayName={name || "Your name"}
            bio={bio || null}
            avatarUrl={/^https:\/\//i.test(avatar) ? avatar : null}
            theme={theme}
            links={links.filter((l) => l.is_active).map((l) => ({ id: l.id, title: l.title, href: "#" }))}
            footer={false}
          />
        </div>
      </div>
    </div>
  );
}

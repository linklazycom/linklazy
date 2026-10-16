import { getBioTheme } from "@/lib/bio/themes";

export interface BioViewLink {
  id: string;
  title: string;
  href: string;
}

/**
 * The bio page itself. Used by the public page AND the editor's live preview,
 * so what you see while editing is exactly what visitors get.
 * All text is rendered as plain text by React (never as HTML).
 */
export function BioView({
  displayName,
  bio,
  avatarUrl,
  theme,
  links,
  footer = true,
}: {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: string;
  links: BioViewLink[];
  footer?: boolean;
}) {
  const t = getBioTheme(theme);
  return (
    <div style={{ background: t.bg, color: t.text }} className="flex w-full flex-1 flex-col items-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="mx-auto mb-4 h-24 w-24 rounded-full object-cover" style={{ border: `2px solid ${t.border}` }} />
        ) : (
          <div
            className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold"
            style={{ background: t.button, color: t.buttonText, border: `2px solid ${t.border}` }}
            aria-hidden="true"
          >
            {(displayName.trim()[0] ?? "?").toUpperCase()}
          </div>
        )}
        <h1 className="text-xl font-semibold">{displayName}</h1>
        {bio && (
          <p className="mt-2 whitespace-pre-line text-sm" style={{ color: t.muted }}>
            {bio}
          </p>
        )}
        <ul className="mt-6 space-y-3">
          {links.map((l) => (
            <li key={l.id}>
              <a
                href={l.href}
                rel="nofollow ugc noopener noreferrer"
                className="block w-full rounded-xl px-4 py-3 text-sm font-medium transition hover:opacity-90"
                style={{ background: t.button, color: t.buttonText, border: `1px solid ${t.border}` }}
              >
                {l.title}
              </a>
            </li>
          ))}
          {links.length === 0 && (
            <li className="text-sm" style={{ color: t.muted }}>
              No links yet.
            </li>
          )}
        </ul>
        {footer && (
          <p className="mt-10 text-xs" style={{ color: t.muted }}>
            Made with{" "}
            <a href="/" style={{ color: t.text }} className="underline">
              LinkLazy
            </a>{" "}
            ·{" "}
            <a href="/support" rel="nofollow" style={{ color: t.muted }} className="underline">
              Report this page
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

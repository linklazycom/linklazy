import { cn } from "@/lib/utils";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Circular avatar image, falling back to initials-on-a-colored-circle when
 * no avatar_url is set (or it fails to load) — used on the public profile
 * page, the site-detail sidebar card, and the profile edit page, so the
 * fallback look stays consistent everywhere a user might not have
 * uploaded a photo yet.
 */
export function ProfileAvatar({
  url,
  name,
  size = 40,
  className,
}: {
  url: string | null;
  name: string | null;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar URLs are user-uploaded Supabase storage files, not part of the Next.js image pipeline
      <img
        src={url}
        alt={name ?? "Profile photo"}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-line object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-line bg-brand-soft font-display font-medium text-brand-violet",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

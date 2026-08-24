"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";

/**
 * Uploads a new avatar directly to Supabase Storage from the browser
 * (bucket: "avatars", RLS-scoped so a user can only write under their own
 * `${userId}/` folder — see sql/002_public_profiles.sql), then patches
 * profiles.avatar_url to the new public URL via the existing profile API.
 */
export function AvatarUpload({
  userId,
  currentUrl,
  displayName,
  onUploaded,
}: {
  userId: string;
  currentUrl: string | null;
  displayName: string | null;
  onUploaded: (url: string) => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setError("Image must be under 3MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please upload a PNG, JPEG, or WebP image.");
      return;
    }

    setUploading(true);
    setError(null);

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-bust so the new photo shows immediately instead of the
    // browser (or a CDN) serving the previous file at the same path.
    const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: url }),
    });

    setUploading(false);
    if (!res.ok) {
      setError("Photo uploaded but couldn't be saved to your profile. Try again.");
      return;
    }
    onUploaded(url);
  }

  return (
    <div className="flex items-center gap-4">
      <ProfileAvatar url={currentUrl} name={displayName} size={64} />
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading…" : currentUrl ? "Change photo" : "Upload photo"}
        </Button>
        <p className="mt-1 text-xs text-muted">PNG, JPEG, or WebP — up to 3MB.</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

export interface PexelsPhoto {
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

/**
 * Deterministic string hash used to pick a consistent-but-varied photo
 * index per article, so the same seed always gets the same photo (good
 * for caching) but different articles with similar/overlapping keywords
 * don't all collapse onto Pexels' single top result.
 */
function seededIndex(seed: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return max > 0 ? hash % max : 0;
}

/**
 * Searches Pexels for a relevant photo. Requires PEXELS_API_KEY.
 * Returns null (never throws) if the key is missing, the request fails,
 * or no results are found — callers should always have a fallback
 * (e.g. the brand-gradient SVG cover) since this is a "nice to have."
 *
 * `seed` (typically the article slug) is used to pick which result from
 * the candidate pool to use, so two articles searching similar/generic
 * keywords (e.g. "seo", "link building") don't both end up with the
 * exact same image — each seed deterministically lands on a different
 * candidate out of the top results, while still being cache-stable for
 * the same article on repeat visits.
 *
 * Pexels' API terms require crediting the photographer and Pexels
 * wherever a photo is used — see PexelsCredit component.
 */
export async function searchPexelsPhoto(query: string, seed?: string): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 60 * 60 * 24 }, // cache for a day — no need to re-search every request
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const photos = data?.photos ?? [];
    if (photos.length === 0) return null;

    const index = seed ? seededIndex(seed, photos.length) : 0;
    const photo = photos[index];
    if (!photo) return null;

    return {
      url: photo.src?.large ?? photo.src?.original,
      alt: photo.alt || query,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
    };
  } catch {
    return null;
  }
}

/**
 * Searches Pexels for multiple distinct photos for the same query — used
 * for inline images spaced through long article content. Returns up to
 * `count` photos, each different from the others (no repeats within the
 * same call), skipping the hero image's index if `excludeSeed` is given
 * so the hero and the inline images don't repeat the same shot.
 */
export async function searchPexelsPhotos(
  query: string,
  count: number,
  excludeSeed?: string
): Promise<PexelsPhoto[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.max(
        count + 1,
        10
      )}&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 60 * 60 * 24 },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const photos = data?.photos ?? [];
    if (photos.length === 0) return [];

    const excludeIndex = excludeSeed ? seededIndex(excludeSeed, photos.length) : -1;

    return photos
      .filter((_: unknown, i: number) => i !== excludeIndex)
      .slice(0, count)
      .map((photo: { src?: { large?: string; original?: string }; alt?: string; photographer?: string; photographer_url?: string }) => ({
        url: photo.src?.large ?? photo.src?.original,
        alt: photo.alt || query,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
      }));
  } catch {
    return [];
  }
}

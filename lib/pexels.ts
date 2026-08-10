export interface PexelsPhoto {
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

/**
 * Searches Pexels for a single relevant photo. Requires PEXELS_API_KEY.
 * Returns null (never throws) if the key is missing, the request fails,
 * or no results are found — callers should always have a fallback
 * (e.g. the brand-gradient SVG cover) since this is a "nice to have."
 *
 * Pexels' API terms require crediting the photographer and Pexels
 * wherever a photo is used — see PexelsCredit component.
 */
export async function searchPexelsPhoto(query: string): Promise<PexelsPhoto | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 60 * 60 * 24 }, // cache for a day — no need to re-search every request
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const photo = data?.photos?.[0];
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

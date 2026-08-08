/**
 * Asks the Wayback Machine to capture a snapshot of a delivered link's
 * live page, so there's independent proof of the placement even if the
 * seller later removes the link. Best-effort — failures are non-fatal,
 * since the buyer's own accept step is the real verification gate.
 */
export async function captureArchiveSnapshot(url: string): Promise<string | null> {
  try {
    const saveUrl = `https://web.archive.org/save/${url}`;
    const res = await fetch(saveUrl, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "LinkLazy-OrderProof/1.0" },
    });

    // The Wayback "save" endpoint redirects to the snapshot URL on success.
    const contentLocation = res.headers.get("content-location");
    if (contentLocation) {
      return `https://web.archive.org${contentLocation}`;
    }
    if (res.url && res.url.includes("web.archive.org/web/")) {
      return res.url;
    }
    return null;
  } catch {
    return null; // Non-fatal — proof_url is still stored regardless.
  }
}

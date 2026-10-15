/** Reads a JSON body with a size cap; returns null when missing/invalid/too big. */
export async function readJson(request: Request, maxBytes = 200_000): Promise<unknown | null> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

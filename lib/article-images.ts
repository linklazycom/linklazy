import type { PexelsPhoto } from "@/lib/pexels";

/**
 * Splits rendered article HTML into inline images spaced roughly every
 * `wordsPerImage` words, inserted after the nearest block-level element
 * boundary (so an image never lands mid-paragraph or inside a list/table).
 *
 * Each image gets a lightweight <figure> with photographer credit,
 * matching Pexels' attribution requirement (see components/ui/pexels-credit.tsx
 * for the equivalent React version used elsewhere).
 */
export function injectInlineImages(html: string, photos: PexelsPhoto[], wordsPerImage = 450): string {
  if (photos.length === 0) return html;

  // Split on the end of any block-level element, keeping the delimiter
  // attached to the preceding chunk so we only ever insert *between*
  // blocks, never inside one.
  const blockEndPattern = /(<\/p>|<\/ul>|<\/ol>|<\/table>|<\/blockquote>|<\/h2>|<\/h3>)/;
  const parts = html.split(blockEndPattern);

  // Recombine into whole blocks (text + its closing tag come back together
  // after split, since the pattern is captured).
  const blocks: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = (parts[i] ?? "") + (parts[i + 1] ?? "");
    if (chunk.trim()) blocks.push(chunk);
  }

  let wordCount = 0;
  let photoIndex = 0;
  const output: string[] = [];

  for (const block of blocks) {
    output.push(block);
    const textOnly = block.replace(/<[^>]+>/g, " ");
    wordCount += textOnly.split(/\s+/).filter(Boolean).length;

    if (wordCount >= wordsPerImage && photoIndex < photos.length) {
      const photo = photos[photoIndex];
      output.push(`
<figure class="my-6">
  <img src="${photo.url}" alt="${escapeAttr(photo.alt)}" class="w-full rounded-chip" loading="lazy" />
  <figcaption class="mt-1.5 text-[11px] text-muted">
    Photo by <a href="${photo.photographerUrl}" target="_blank" rel="noreferrer" class="underline">${escapeAttr(
        photo.photographer
      )}</a> on <a href="https://www.pexels.com" target="_blank" rel="noreferrer" class="underline">Pexels</a>
  </figcaption>
</figure>
`);
      photoIndex++;
      wordCount = 0;
    }
  }

  return output.join("");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

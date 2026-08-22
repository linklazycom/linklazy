import type { ReactNode } from "react";

/**
 * Renders a small, safe markdown-like subset for seller-authored free text
 * (site guidelines, etc.) as React elements — never as raw HTML/
 * dangerouslySetInnerHTML. Sellers are semi-trusted marketplace
 * participants, not admins, so their text must never be able to inject
 * markup; going through React's normal text-node escaping keeps that true
 * no matter what a seller types.
 *
 * Supported subset (intentionally small):
 *   ## Heading            -> <h3>
 *   **bold text**         -> <strong> (inline, within a line)
 *   - item / * item       -> bullet list
 *   blank-line-separated  -> paragraphs
 */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return <div className={className}>{blocks}</div>;
}

function parseInline(line: string, keyPrefix: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function parseBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let blockIndex = 0;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const key = `p-${blockIndex++}`;
    blocks.push(
      <p key={key} className="mb-3 leading-relaxed last:mb-0">
        {paragraphLines.map((l, i) => (
          <span key={i}>
            {parseInline(l, `${key}-${i}`)}
            {i < paragraphLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    const key = `ul-${blockIndex++}`;
    blocks.push(
      <ul key={key} className="mb-3 list-disc space-y-1 pl-5 last:mb-0">
        {listItems.map((item, i) => (
          <li key={i}>{parseInline(item, `${key}-${i}`)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);

    if (heading) {
      flushParagraph();
      flushList();
      const key = `h-${blockIndex++}`;
      blocks.push(
        <h3 key={key} className="mb-2 mt-4 font-display text-sm font-semibold first:mt-0">
          {parseInline(heading[2], key)}
        </h3>
      );
    } else if (bullet) {
      flushParagraph();
      listItems.push(bullet[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  flushList();

  return blocks;
}

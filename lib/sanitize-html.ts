import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes HTML rendered from admin-authored markdown (blog articles,
 * case studies) before it's injected via dangerouslySetInnerHTML.
 *
 * Content is written by trusted admins today, but this is cheap insurance
 * against a compromised admin account, a supply-chain issue in `marked`,
 * or this content model later opening up to guest authors — and it costs
 * nothing on the happy path since normal article HTML passes through
 * untouched.
 *
 * Uses `sanitize-html` (pure JS, no DOM emulation) rather than
 * isomorphic-dompurify/jsdom — jsdom pulls in a dependency chain
 * (html-encoding-sniffer -> @exodus/bytes) that ships an ESM-only build
 * and fails to load under Vercel's serverless bundling
 * ("ERR_REQUIRE_ESM"), taking down every page that sanitizes HTML.
 * sanitize-html has no such native/ESM sub-dependencies.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "sub",
  "sup",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
];

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "class"],
      img: ["src", "alt", "class", "loading", "width", "height"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
}

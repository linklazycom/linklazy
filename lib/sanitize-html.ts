import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes HTML rendered from admin-authored markdown (blog articles,
 * case studies) before it's injected via dangerouslySetInnerHTML.
 *
 * Content is written by trusted admins today, but this is cheap insurance
 * against a compromised admin account, a supply-chain issue in `marked`,
 * or this content model later opening up to guest authors — and it costs
 * nothing on the happy path since normal article HTML passes through
 * untouched.
 */
export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["figure", "figcaption"],
    ADD_ATTR: ["target", "rel", "loading"],
  });
}

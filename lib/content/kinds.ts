/**
 * AI Content Studio (Batch 15): the list of tools and the fields each one takes.
 * Pure data, no imports from the server: shared by the API routes, the prompt builder, the UI and the tests.
 */
export const CONTENT_KINDS = [
  "outreach_email",
  "bio",
  "article_ideas",
  "article_outline",
  "article_draft",
  "title_meta",
  "alt_text",
  "comment_draft",
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export function isContentKind(v: unknown): v is ContentKind {
  return typeof v === "string" && (CONTENT_KINDS as readonly string[]).includes(v);
}

export const CONTENT_LANGUAGES = ["English", "Bengali", "Spanish", "Portuguese", "French", "German", "Hindi", "Arabic", "Indonesian", "Turkish"] as const;
export const CONTENT_TONES = ["friendly", "professional", "casual", "confident", "formal"] as const;
export const ARTICLE_LENGTHS = ["500", "800", "1200", "1500"] as const;
export const BIO_LENGTHS = ["50", "100", "200"] as const;

export interface FieldDef {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  max: number;
  options?: readonly string[];
  placeholder?: string;
  help?: string;
}

const language: FieldDef = { id: "language", label: "Language", type: "select", options: CONTENT_LANGUAGES, max: 20 };
const tone: FieldDef = { id: "tone", label: "Tone", type: "select", options: CONTENT_TONES, max: 20 };

export interface KindDef {
  id: ContentKind;
  label: string;
  description: string;
  /** Wallet action charged per use (Batch 14 pricing; free until an admin sets a price). */
  action: "content_generate" | "content_article_draft";
  maxTokens: number;
  fields: FieldDef[];
  /** Shown under the result. */
  reviewNote: string;
}

export const KIND_DEFS: Record<ContentKind, KindDef> = {
  outreach_email: {
    id: "outreach_email",
    label: "Outreach email",
    description: "A short, personal pitch to a site owner or editor.",
    action: "content_generate",
    maxTokens: 700,
    fields: [
      { id: "goal", label: "Goal", type: "select", required: true, max: 40, options: ["guest post pitch", "link insertion request", "resource page suggestion", "partnership idea"] },
      { id: "recipient", label: "Recipient or site (optional)", type: "text", max: 150, placeholder: "e.g. Maria at Example Blog" },
      { id: "pitch", label: "What you are offering and why it fits them", type: "textarea", required: true, max: 1500 },
      tone,
      language,
    ],
    reviewNote: "Personalise this before sending and send it yourself, one recipient at a time. Never mass-send AI emails.",
  },
  bio: {
    id: "bio",
    label: "Profile / company bio",
    description: "A bio for an author box, directory or social profile.",
    action: "content_generate",
    maxTokens: 500,
    fields: [
      { id: "subject", label: "Person or company name", type: "text", required: true, max: 120 },
      { id: "kind", label: "Bio for", type: "select", required: true, max: 20, options: ["a person", "a company"] },
      { id: "facts", label: "Facts to use (only these will be used)", type: "textarea", required: true, max: 1500 },
      { id: "length", label: "Length (words)", type: "select", max: 6, options: BIO_LENGTHS },
      tone,
      language,
    ],
    reviewNote: "Check every fact: the AI may only use what you gave it, but always read it before you publish it.",
  },
  article_ideas: {
    id: "article_ideas",
    label: "Article ideas",
    description: "A list of article ideas with a working title and angle.",
    action: "content_generate",
    maxTokens: 900,
    fields: [
      { id: "topic", label: "Topic or niche", type: "text", required: true, max: 200 },
      { id: "audience", label: "Audience (optional)", type: "text", max: 200 },
      { id: "count", label: "How many ideas", type: "select", max: 3, options: ["5", "8", "10"] },
      language,
    ],
    reviewNote: "Ideas are starting points. Check what already ranks for them before you commit.",
  },
  article_outline: {
    id: "article_outline",
    label: "Article outline",
    description: "Headings and key points for an article.",
    action: "content_generate",
    maxTokens: 1000,
    fields: [
      { id: "topic", label: "Working title or topic", type: "text", required: true, max: 250 },
      { id: "audience", label: "Audience (optional)", type: "text", max: 200 },
      { id: "keywords", label: "Keywords to cover (optional, one per line)", type: "textarea", max: 400 },
      language,
    ],
    reviewNote: "Edit the outline, then use it as the input for a draft.",
  },
  article_draft: {
    id: "article_draft",
    label: "Article draft",
    description: "A full first draft from a topic or an outline you edited.",
    action: "content_article_draft",
    maxTokens: 3500,
    fields: [
      { id: "topic", label: "Title or topic", type: "text", required: true, max: 250 },
      { id: "outline", label: "Outline to follow (optional, paste yours)", type: "textarea", max: 4000 },
      { id: "keywords", label: "Keywords to work in naturally (optional)", type: "textarea", max: 400 },
      { id: "length", label: "Length (words, approximate)", type: "select", max: 6, options: ARTICLE_LENGTHS },
      tone,
      language,
    ],
    reviewNote: "This is a first draft. A person must edit it, fact-check every claim, add real examples and sources, and make it their own before publishing. Nothing guarantees rankings or backlinks.",
  },
  title_meta: {
    id: "title_meta",
    label: "Title and meta description",
    description: "Title tag and meta description options for a page.",
    action: "content_generate",
    maxTokens: 700,
    fields: [
      { id: "summary", label: "What the page is about", type: "textarea", required: true, max: 1000 },
      { id: "keyword", label: "Main keyword (optional)", type: "text", max: 100 },
      language,
    ],
    reviewNote: "Check the lengths yourself (titles about 60 characters, descriptions about 155) and that they match the page.",
  },
  alt_text: {
    id: "alt_text",
    label: "Image alt text",
    description: "Short alt text options. The AI cannot see the image: describe it.",
    action: "content_generate",
    maxTokens: 300,
    fields: [
      { id: "description", label: "What the image shows", type: "textarea", required: true, max: 500 },
      { id: "context", label: "Where it is used (optional)", type: "text", max: 200 },
      language,
    ],
    reviewNote: "The AI only sees your description, not the image. Make sure the text matches the picture.",
  },
  comment_draft: {
    id: "comment_draft",
    label: "Comment draft",
    description: "A thoughtful comment on an article you have read. You post it yourself.",
    action: "content_generate",
    maxTokens: 500,
    fields: [
      { id: "article", label: "Article title or short summary", type: "textarea", required: true, max: 1500 },
      { id: "point", label: "Your own point or experience", type: "textarea", required: true, max: 800 },
      tone,
      language,
    ],
    reviewNote: "Read the article first, edit this into your own words and post it yourself. No automatic or bulk posting, and no promotional links in comments.",
  },
};

export const CONTENT_NOTICE =
  "AI drafts need a human review and a fact-check. They can contain mistakes, and nothing here guarantees rankings or backlinks.";

/** Hard limits for saved documents. */
export const DOC_TITLE_MAX = 120;
export const DOC_BODY_MAX = 60_000;
export const DOC_MAX_PER_USER = 200;

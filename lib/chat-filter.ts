const PATTERNS: RegExp[] = [
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // International phone numbers (7+ digits, optional +, spaces/dashes)
  /(\+?\d[\d\s-]{6,}\d)/g,
  // WhatsApp / Telegram links or mentions
  /\b(wa\.me|whatsapp|telegram|t\.me)\b[^\s]*/gi,
  // Common social handles / "follow me on ..." patterns
  /\b(instagram|insta|fb|facebook|skype)\s*[:@]?\s*[\w.]+/gi,
  // Bare @handles (conservative — 4+ chars to avoid false positives on short words)
  /@[a-zA-Z0-9_]{4,}/g,
];

export interface FilterResult {
  filtered: string;
  wasFiltered: boolean;
}

/**
 * Masks likely contact-info from a chat message. This is intentionally
 * conservative (a few false positives are fine — losing platform revenue
 * to off-platform deals is the bigger risk). The original text is kept
 * separately for admin moderation only, never shown to the other party.
 */
export function filterContactInfo(text: string): FilterResult {
  let filtered = text;
  let wasFiltered = false;

  for (const pattern of PATTERNS) {
    if (pattern.test(filtered)) {
      wasFiltered = true;
      filtered = filtered.replace(pattern, "[hidden]");
    }
  }

  return { filtered, wasFiltered };
}

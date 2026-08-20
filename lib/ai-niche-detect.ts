import { NICHES } from "@/lib/niches";

export type AiProvider = "openai" | "gemini" | "claude";

export interface AiVote {
  provider: AiProvider;
  niche: string | null;
  error?: string;
}

const SYSTEM_PROMPT = `You are a website classifier. Given a short excerpt of a website's homepage text, reply with EXACTLY ONE of the following niche names, and nothing else — no punctuation, no explanation:
${NICHES.join("\n")}
If the content clearly doesn't fit any of these, reply with exactly: NONE`;

function buildUserPrompt(pageText: string): string {
  // Keep the prompt small/cheap — a few hundred words of homepage
  // signal text is plenty for a niche classification, and keeps every
  // provider's cost negligible per scan.
  return `Website homepage text:\n"""\n${pageText.slice(0, 3000)}\n"""\n\nWhich niche is this?`;
}

function parseNicheReply(raw: string): string | null {
  const cleaned = raw.trim().replace(/^["'.]|["'.]$/g, "");
  if (cleaned.toUpperCase() === "NONE") return null;
  // Exact match against the canonical list only — never trust the model
  // to invent a niche name that isn't one of ours.
  const match = NICHES.find((n) => n.toLowerCase() === cleaned.toLowerCase());
  return match ?? null;
}

async function classifyWithOpenAI(pageText: string): Promise<AiVote> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: "openai", niche: null, error: "OPENAI_API_KEY not set" };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 20,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(pageText) },
        ],
      }),
    });
    if (!res.ok) return { provider: "openai", niche: null, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return { provider: "openai", niche: parseNicheReply(text) };
  } catch (err) {
    return { provider: "openai", niche: null, error: (err as Error).message };
  }
}

async function classifyWithGemini(pageText: string): Promise<AiVote> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { provider: "gemini", niche: null, error: "GEMINI_API_KEY not set" };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: buildUserPrompt(pageText) }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 20 },
        }),
      }
    );
    if (!res.ok) return { provider: "gemini", niche: null, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { provider: "gemini", niche: parseNicheReply(text) };
  } catch (err) {
    return { provider: "gemini", niche: null, error: (err as Error).message };
  }
}

async function classifyWithClaude(pageText: string): Promise<AiVote> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { provider: "claude", niche: null, error: "ANTHROPIC_API_KEY not set" };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Cheap/fast model — this is a simple single-label classification,
        // not a task that needs a larger model.
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(pageText) }],
      }),
    });
    if (!res.ok) return { provider: "claude", niche: null, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    return { provider: "claude", niche: parseNicheReply(text) };
  } catch (err) {
    return { provider: "claude", niche: null, error: (err as Error).message };
  }
}

const CLASSIFIERS: Record<AiProvider, (pageText: string) => Promise<AiVote>> = {
  openai: classifyWithOpenAI,
  gemini: classifyWithGemini,
  claude: classifyWithClaude,
};

export interface AiNicheResult {
  niche: string | null;
  confidence: number; // 0-100, based on how many enabled providers agreed
  votes: AiVote[];
}

/**
 * Calls every enabled provider in parallel and returns the majority-vote
 * niche. With one provider enabled, its answer is used directly. With
 * multiple, agreement raises confidence; a tie is broken by provider
 * priority (claude > openai > gemini) since that's an arbitrary but
 * stable rule rather than silently picking randomly.
 */
export async function classifyNicheWithAi(
  pageText: string,
  enabledProviders: AiProvider[]
): Promise<AiNicheResult> {
  if (enabledProviders.length === 0) {
    return { niche: null, confidence: 0, votes: [] };
  }

  const votes = await Promise.all(enabledProviders.map((p) => CLASSIFIERS[p](pageText)));

  const tally = new Map<string, number>();
  for (const v of votes) {
    if (v.niche) tally.set(v.niche, (tally.get(v.niche) ?? 0) + 1);
  }

  if (tally.size === 0) {
    return { niche: null, confidence: 0, votes };
  }

  const priority: AiProvider[] = ["claude", "openai", "gemini"];
  let bestNiche: string | null = null;
  let bestCount = 0;
  for (const [niche, count] of tally.entries()) {
    if (count > bestCount) {
      bestNiche = niche;
      bestCount = count;
    } else if (count === bestCount && bestNiche) {
      // Tie-break: whichever niche the higher-priority provider picked wins.
      for (const p of priority) {
        const vote = votes.find((v) => v.provider === p);
        if (vote?.niche === niche) {
          bestNiche = niche;
          break;
        }
        if (vote?.niche === bestNiche) break;
      }
    }
  }

  const confidence = Math.round((bestCount / enabledProviders.length) * 100);
  return { niche: bestNiche, confidence, votes };
}

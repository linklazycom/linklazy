/**
 * Pure request-building / response-parsing for AI providers (no imports, so it
 * is unit-tested with the Node test runner). The network call itself happens in
 * lib/api-providers.ts through the SSRF-safe client.
 *
 * Adapters implemented now:
 *  - "openai_compatible": OpenAI, Groq, OpenRouter, Together, Mistral, DeepSeek,
 *    Gemini's OpenAI-compatible endpoint, and any self-hosted server that
 *    speaks the OpenAI chat-completions format.
 *  - "anthropic": Claude (Messages API).
 * Search / image adapters are added in later batches.
 */
export const AI_ADAPTERS = ["openai_compatible", "anthropic"] as const;
export type AiAdapterId = (typeof AI_ADAPTERS)[number];

export function isAiAdapter(value: unknown): value is AiAdapterId {
  return typeof value === "string" && (AI_ADAPTERS as readonly string[]).includes(value);
}

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequestInput {
  adapter: AiAdapterId;
  baseUrl: string | null;
  apiKey: string;
  model: string;
  system?: string;
  messages: AiTurn[];
  maxTokens: number;
  temperature?: number;
}

export interface BuiltAiRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface ParsedAiResponse {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

const DEFAULT_BASE: Record<AiAdapterId, string> = {
  openai_compatible: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
};

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function buildAiRequest(input: AiRequestInput): BuiltAiRequest {
  const base = trimSlash(input.baseUrl?.trim() || DEFAULT_BASE[input.adapter]);

  if (input.adapter === "anthropic") {
    const payload: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxTokens,
      messages: input.messages,
    };
    if (input.system) payload.system = input.system;
    if (input.temperature !== undefined) payload.temperature = input.temperature;
    return {
      url: base.endsWith("/v1") ? `${base}/messages` : `${base}/v1/messages`,
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    };
  }

  // openai_compatible
  const messages = input.system
    ? [{ role: "system", content: input.system }, ...input.messages]
    : input.messages;
  const payload: Record<string, unknown> = { model: input.model, messages };
  // OpenAI's newer models reject "max_tokens" and want "max_completion_tokens";
  // most other compatible servers still expect "max_tokens".
  let isOpenAiHost = false;
  try {
    isOpenAiHost = new URL(base).hostname === "api.openai.com";
  } catch {
    isOpenAiHost = false;
  }
  payload[isOpenAiHost ? "max_completion_tokens" : "max_tokens"] = input.maxTokens;
  if (input.temperature !== undefined) payload.temperature = input.temperature;
  return {
    url: `${base}/chat/completions`,
    headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify(payload),
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseAiResponse(adapter: AiAdapterId, json: unknown): ParsedAiResponse {
  const root = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;

  if (adapter === "anthropic") {
    const content = Array.isArray(root.content) ? root.content : [];
    const text = content
      .map((b) => (b && typeof b === "object" && (b as Record<string, unknown>).type === "text" ? String((b as Record<string, unknown>).text ?? "") : ""))
      .join("")
      .trim();
    if (!text) throw new Error("The provider returned no text.");
    const usage = (root.usage ?? {}) as Record<string, unknown>;
    return { text, inputTokens: num(usage.input_tokens), outputTokens: num(usage.output_tokens) };
  }

  const choices = Array.isArray(root.choices) ? root.choices : [];
  const first = (choices[0] ?? {}) as Record<string, unknown>;
  const message = (first.message ?? {}) as Record<string, unknown>;
  let text = "";
  if (typeof message.content === "string") {
    text = message.content;
  } else if (Array.isArray(message.content)) {
    text = message.content
      .map((p) => (p && typeof p === "object" ? String((p as Record<string, unknown>).text ?? "") : ""))
      .join("");
  }
  text = text.trim();
  if (!text) throw new Error("The provider returned no text.");
  const usage = (root.usage ?? {}) as Record<string, unknown>;
  return { text, inputTokens: num(usage.prompt_tokens), outputTokens: num(usage.completion_tokens) };
}

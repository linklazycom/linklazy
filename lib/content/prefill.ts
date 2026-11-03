/**
 * Opening the AI Content Studio with an outreach email already half filled in (Batch 23C): from an Opportunity Finder result the user
 * presses "Draft outreach email". Pure. Everything in the address is untrusted, so each part is checked before it is used.
 */
export const OUTREACH_GOALS = ["guest post pitch", "link insertion request", "resource page suggestion", "partnership idea"] as const;
export type OutreachGoal = (typeof OUTREACH_GOALS)[number];

const RECIPIENT_MAX = 150;
const PITCH_MAX = 1500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only kinds of opportunity that make sense as an email get the button; directories, profiles and comments are not emailed. */
export function outreachGoalFor(oppType: string): OutreachGoal | null {
  if (oppType === "guest_post") return "guest post pitch";
  if (oppType === "resource_page") return "resource page suggestion";
  return null;
}

const clip = (v: string, n: number) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, n);

export interface OutreachSource {
  projectId: string;
  projectName: string;
  oppType: string;
  domain: string;
  title: string;
  url: string;
}

/** The Content Studio address for this opportunity, or null when its kind is not something you email. */
export function buildOutreachPrefillHref(o: OutreachSource): string | null {
  const goal = outreachGoalFor(o.oppType);
  if (!goal || !UUID_RE.test(o.projectId)) return null;
  const pitch = clip(`Their page: ${clip(o.title || o.domain, 120)} (${clip(o.url, 300)})\nMy site: ${clip(o.projectName, 100)}\nWhat I offer and why it fits their readers: `, PITCH_MAX);
  const p = new URLSearchParams({ kind: "outreach_email", project: o.projectId, goal, recipient: clip(o.domain, RECIPIENT_MAX), pitch });
  return `/dashboard/content?${p.toString()}`;
}

export interface StudioPrefill {
  kind: "outreach_email";
  projectId: string | null;
  values: Record<string, string>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads the address back. The project must be one of the user's own; the goal must be a known one; the texts are length-limited. */
export function parseStudioPrefill(sp: Record<string, string | string[] | undefined>, ownProjectIds: string[]): StudioPrefill | null {
  if (first(sp.kind) !== "outreach_email") return null;
  const goalRaw = first(sp.goal);
  const goal = (OUTREACH_GOALS as readonly string[]).includes(goalRaw) ? goalRaw : "";
  const recipient = clip(first(sp.recipient), RECIPIENT_MAX);
  const pitch = clip(first(sp.pitch), PITCH_MAX);
  if (!goal && !recipient && !pitch) return null;
  const projectRaw = first(sp.project);
  const projectId = UUID_RE.test(projectRaw) && ownProjectIds.includes(projectRaw) ? projectRaw : null;
  const values: Record<string, string> = {};
  if (goal) values.goal = goal;
  if (recipient) values.recipient = recipient;
  if (pitch) values.pitch = pitch;
  return { kind: "outreach_email", projectId, values };
}

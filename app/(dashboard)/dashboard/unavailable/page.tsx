import Link from "next/link";
import { toolById } from "@/lib/features/registry";

export const metadata = { title: "Tool unavailable" };

export default async function ToolUnavailablePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = Array.isArray(sp.tool) ? sp.tool[0] : sp.tool;
  const tool = id ? toolById(id) : undefined;
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-display text-2xl font-medium">{tool ? `${tool.label} is switched off` : "This tool is switched off"}</h1>
      <p className="text-sm text-muted">This tool is not available right now. Your saved work is safe and will be there when it comes back.</p>
      <Link href="/dashboard" className="inline-block rounded-chip border border-line bg-white px-4 py-2 text-sm underline">Back to dashboard</Link>
    </div>
  );
}

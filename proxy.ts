import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // "l/" = short-link redirects (/l/<slug>): they are public and must stay fast, so they skip the
    // Supabase session refresh (one network round-trip) that every other page pays.
    "/((?!_next/static|_next/image|favicon.ico|l/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

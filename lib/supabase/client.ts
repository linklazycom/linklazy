import { createBrowserClient } from "@supabase/ssr";
// NOTE: once you've run `npm run gen:types` against your real Supabase
// project, import { Database } from "@/types/database" and pass it as
// createBrowserClient<Database>(...) here for full query type-safety.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

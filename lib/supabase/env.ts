// Supabase config read from env. Missing config never throws at import/build time;
// callers get null (or a clear error message) so the app degrades gracefully.
export const SUPABASE_MISSING_MSG =
  'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see README → Supabase setup).';

export function supabaseEnv(): { url: string; anonKey: string } | null {
  // Reference process.env.NEXT_PUBLIC_* literally so Next inlines them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

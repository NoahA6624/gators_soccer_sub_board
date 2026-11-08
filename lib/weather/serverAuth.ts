// Server-only Supabase session check for /api/weather. OWNED BY AGENT D.
// Local to lib/weather so it doesn't collide with lib/supabase/* (agent B); swap for theirs later.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export type AuthResult = { ok: true; userId: string | null } | { ok: false; status: 401 | 500; error: string };

/** Requires a signed-in Supabase session. Without Supabase config, allowed only when NODE_ENV === 'development'. */
export async function requireUser(): Promise<AuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return process.env.NODE_ENV === 'development'
      ? { ok: true, userId: null }
      : { ok: false, status: 500, error: 'Supabase is not configured' };
  }
  const store = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only context */ }
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, error: 'Sign in required' };
  return { ok: true, userId: data.user.id };
}

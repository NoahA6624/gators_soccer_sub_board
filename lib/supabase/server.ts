import 'server-only';
// Server Supabase client for Server Components, Route Handlers and Server Actions (cookie session).
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPABASE_MISSING_MSG, supabaseEnv } from './env';

export async function createClient(): Promise<SupabaseClient> {
  const env = supabaseEnv();
  if (!env) throw new Error(SUPABASE_MISSING_MSG);
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component (read-only cookies). Middleware refreshes the session.
        }
      },
    },
  });
}

/** Signed-in user (verified with Supabase Auth) or null. Never throws. For API routes: `if (!user) 401`. */
export async function getUser(): Promise<User | null> {
  if (!supabaseEnv()) return null;
  try {
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** True when the signed-in user has role 'editor'. */
export async function isEditor(): Promise<boolean> {
  if (!supabaseEnv()) return false;
  try {
    const sb = await createClient();
    const { data } = await sb.rpc('is_editor');
    return data === true;
  } catch {
    return false;
  }
}

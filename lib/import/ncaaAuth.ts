// Tiny server-side session check for app/api/ncaa (kept local to avoid coupling with lib/supabase, owned by B).
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** Returns the signed-in user's id, or null if there is no valid Supabase session. */
export async function getSessionUserId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const store = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Route handlers may not be able to set cookies in every context; a read-only check is fine.
        }
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

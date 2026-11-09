// Shared service-role client for CLI scripts (run with `npx tsx`). Reads .env.local if present.
// Not lib/supabase/admin.ts: that one is `server-only` and can't be imported outside Next.
import { existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function scriptAdminClient(): SupabaseClient {
  if (existsSync('.env.local')) {
    try { process.loadEnvFile('.env.local'); } catch { /* older Node: rely on real env vars */ }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

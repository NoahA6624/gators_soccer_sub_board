'use client';
// Browser Supabase client (singleton). Returns null when env is missing.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MISSING_MSG, supabaseEnv } from './env';

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (client) return client;
  const env = supabaseEnv();
  if (!env) return null;
  client = createBrowserClient(env.url, env.anonKey);
  return client;
}

/** Like getBrowserClient but throws a clear error when Supabase is not configured. */
export function requireBrowserClient(): SupabaseClient {
  const c = getBrowserClient();
  if (!c) throw new Error(SUPABASE_MISSING_MSG);
  return c;
}

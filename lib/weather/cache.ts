// Supabase-backed weather_cache adapter (no Next.js imports, usable from scripts). OWNED BY AGENT D.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { HourlyPayload, WeatherCache } from './openmeteo';

export function supabaseWeatherCache(db: SupabaseClient): WeatherCache {
  return {
    async get(k) {
      const { data, error } = await db.from('weather_cache').select('payload, fetched_at').eq('key', k).maybeSingle();
      if (error || !data) return null;
      const row = data as { payload: HourlyPayload; fetched_at: string };
      return { payload: row.payload, fetched_at: row.fetched_at };
    },
    async set(k, payload) {
      await db.from('weather_cache').upsert({ key: k, payload, fetched_at: new Date().toISOString() });
    },
  };
}

/** Service-role client, or null when NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing. */
export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** weather_cache via service role, or null (cache skipped) when env vars are missing. */
export function serviceWeatherCache(): WeatherCache | null {
  const db = serviceClient();
  return db ? supabaseWeatherCache(db) : null;
}

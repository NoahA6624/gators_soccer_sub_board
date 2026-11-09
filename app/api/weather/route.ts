// GET/POST /api/weather — Open-Meteo proxy with Supabase weather_cache. OWNED BY AGENT D.
import { NextResponse, type NextRequest } from 'next/server';
import { getGameWeather, WeatherInputError, WeatherUpstreamError } from '@/lib/weather/openmeteo';
import type { WeatherQuery } from '@/lib/weather';
import { requireUser } from '@/lib/weather/serverAuth';
import { serviceWeatherCache } from '@/lib/weather/cache';

export const dynamic = 'force-dynamic';

async function handle(q: Partial<WeatherQuery>) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const env = await getGameWeather(q, {
      fetch: (u, i) => fetch(u, { ...i, cache: 'no-store' }),
      apiKey: process.env.OPEN_METEO_API_KEY || undefined,
      cache: serviceWeatherCache(),
    });
    return NextResponse.json({ env });
  } catch (e) {
    if (e instanceof WeatherInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof WeatherUpstreamError) return NextResponse.json({ error: e.reason, reason: e.reason }, { status: 502 });
    return NextResponse.json({ error: 'Weather lookup failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const s = (k: string) => sp.get(k) ?? undefined;
  const n = (k: string) => (sp.get(k) == null || sp.get(k) === '' ? undefined : Number(sp.get(k)));
  return handle({ date: s('date') as string, kickoff: s('kickoff'), location: s('location'), venue: s('venue'), lat: n('lat'), lon: n('lon') });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  return handle(body as Partial<WeatherQuery>);
}

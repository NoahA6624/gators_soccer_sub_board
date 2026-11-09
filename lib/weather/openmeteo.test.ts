import { describe, expect, it, vi } from 'vitest';
import {
  buildWeatherUrl, cacheKey, chooseEndpoint, getGameWeather, isCacheFresh, pickNearestHour,
  WeatherInputError, WeatherUpstreamError, type HourlyPayload, type WeatherCache,
} from './openmeteo';
import { findKnownVenue, parseCityState } from './venues';
import { mergeEnv } from './merge';

const NOW = new Date('2026-11-08T18:00:00Z');

function hourly(date: string, uv = true) {
  const time = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
  const h = (f: (i: number) => number) => time.map((_, i) => f(i));
  return {
    time,
    temperature_2m: h((i) => 60 + i),
    dew_point_2m: h((i) => 50 + i / 2),
    relative_humidity_2m: h(() => 70),
    apparent_temperature: h((i) => 61 + i),
    precipitation: h(() => 0),
    wind_speed_10m: h(() => 5.25),
    ...(uv ? { uv_index: h((i) => (i > 6 && i < 19 ? 4 : 0)) } : {}),
  };
}

function mockFetch(routes: (url: string) => unknown) {
  return vi.fn(async (url: string) => {
    const body = routes(url);
    const status = (body as { error?: boolean })?.error ? 400 : 200;
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  });
}

describe('endpoint selection', () => {
  it('uses archive for dates more than 5 days old, forecast otherwise', () => {
    expect(chooseEndpoint('2026-09-01', NOW)).toBe('archive');
    expect(chooseEndpoint('2026-11-02', NOW)).toBe('archive'); // 6 days
    expect(chooseEndpoint('2026-11-03', NOW)).toBe('forecast'); // 5 days
    expect(chooseEndpoint('2026-11-08', NOW)).toBe('forecast');
    expect(chooseEndpoint('2026-11-12', NOW)).toBe('forecast');
  });

  it('archive URL omits uv_index; forecast includes it; both use imperial units + timezone=auto', () => {
    const a = new URL(buildWeatherUrl('archive', 29.6447, -82.353, '2026-09-01'));
    const f = new URL(buildWeatherUrl('forecast', 29.6447, -82.353, '2026-11-08'));
    expect(a.origin + a.pathname).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(f.origin + f.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(a.searchParams.get('hourly')).not.toContain('uv_index');
    expect(f.searchParams.get('hourly')).toContain('uv_index');
    for (const u of [a, f]) {
      expect(u.searchParams.get('hourly')).toContain(
        'temperature_2m,dew_point_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m',
      );
      expect(u.searchParams.get('temperature_unit')).toBe('fahrenheit');
      expect(u.searchParams.get('wind_speed_unit')).toBe('mph');
      expect(u.searchParams.get('precipitation_unit')).toBe('inch');
      expect(u.searchParams.get('timezone')).toBe('auto');
      expect(u.searchParams.get('apikey')).toBeNull();
    }
    expect(f.searchParams.get('start_date')).toBe('2026-11-08');
    expect(f.searchParams.get('end_date')).toBe('2026-11-08');
  });

  it('uses customer-* hosts and apikey when a key is set', () => {
    const u = new URL(buildWeatherUrl('archive', 1, 2, '2026-01-01', 'k123'));
    expect(u.hostname).toBe('customer-archive-api.open-meteo.com');
    expect(u.searchParams.get('apikey')).toBe('k123');
    expect(new URL(buildWeatherUrl('forecast', 1, 2, '2026-01-01', 'k')).hostname).toBe('customer-api.open-meteo.com');
  });
});

describe('nearest hour', () => {
  const times = hourly('2026-09-05').time;
  it('picks the slot nearest kickoff, ties to later hour', () => {
    expect(times[pickNearestHour(times, '2026-09-05', '19:00')]).toBe('2026-09-05T19:00');
    expect(times[pickNearestHour(times, '2026-09-05', '19:20')]).toBe('2026-09-05T19:00');
    expect(times[pickNearestHour(times, '2026-09-05', '19:40')]).toBe('2026-09-05T20:00');
    expect(times[pickNearestHour(times, '2026-09-05', '18:30')]).toBe('2026-09-05T19:00');
    expect(times[pickNearestHour(times, '2026-09-05', '23:50')]).toBe('2026-09-05T23:00');
  });
  it('ignores other dates', () => {
    expect(pickNearestHour(times, '2026-09-06', '19:00')).toBe(-1);
  });
});

describe('getGameWeather', () => {
  it('home game resolves Dumas Stadium, archive, default kickoff 19:00', async () => {
    const f = mockFetch(() => ({ hourly: hourly('2026-09-05', false) }));
    const env = await getGameWeather({ date: '2026-09-05', venue: 'Home' }, { fetch: f, now: NOW });
    expect(f).toHaveBeenCalledTimes(1);
    const url = new URL(f.mock.calls[0][0]);
    expect(url.hostname).toBe('archive-api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('29.6447');
    expect(env).toMatchObject({ tempF: 79, dewF: 59.5, rh: 70, uv: null, windMph: 5.3, precipIn: 0, lat: 29.6447, lon: -82.353, src: 'open-meteo', kickoff: '19:00' });
    expect(env.kickoffSrc).toMatch(/default/);
  });

  it('forecast for upcoming game includes uv and given kickoff', async () => {
    const f = mockFetch(() => ({ hourly: hourly('2026-11-09') }));
    const env = await getGameWeather({ date: '2026-11-09', kickoff: '13:00', location: 'Athens, GA' }, { fetch: f, now: NOW });
    expect(new URL(f.mock.calls[0][0]).hostname).toBe('api.open-meteo.com');
    expect(env).toMatchObject({ tempF: 73, uv: 4, lat: 33.939, kickoff: '13:00' });
    expect(env.kickoffSrc).toBeUndefined();
  });

  it('today: Florida @ Arkansas, Razorback Field, 20:00 kickoff → forecast endpoint', async () => {
    const f = mockFetch(() => ({ hourly: hourly('2026-11-08') }));
    const env = await getGameWeather(
      { date: '2026-11-08', kickoff: '20:00', venue: 'Away', location: 'Fayetteville, AR' },
      { fetch: f, now: NOW },
    );
    const u = new URL(f.mock.calls[0][0]);
    expect(u.hostname).toBe('api.open-meteo.com');
    expect(u.searchParams.get('latitude')).toBe('36.0687');
    expect(u.searchParams.get('longitude')).toBe('-94.1748');
    expect(u.searchParams.get('start_date')).toBe('2026-11-08');
    expect(env).toMatchObject({ tempF: 80, kickoff: '20:00', lat: 36.0687, lon: -94.1748 });
    expect(findKnownVenue('Razorback Field')?.school).toBe('Arkansas');
  });

  it('falls back to geocoding for unknown "City, ST"', async () => {
    const f = mockFetch((u) =>
      u.includes('geocoding-api')
        ? { results: [{ latitude: 27.95, longitude: -82.46, name: 'Tampa' }] }
        : { hourly: hourly('2026-09-01', false) },
    );
    const env = await getGameWeather({ date: '2026-09-01', location: 'Tampa, FL' }, { fetch: f, now: NOW });
    const g = new URL(f.mock.calls[0][0]);
    expect(g.origin + g.pathname).toBe('https://geocoding-api.open-meteo.com/v1/search');
    expect(g.searchParams.get('name')).toBe('Tampa');
    expect(g.searchParams.get('count')).toBe('1');
    expect(g.searchParams.get('countryCode')).toBe('US');
    expect(env.lat).toBe(27.95);
    expect(new URL(f.mock.calls[1][0]).searchParams.get('latitude')).toBe('27.9500');
  });

  it('explicit lat/lon wins over venue table', async () => {
    const f = mockFetch(() => ({ hourly: hourly('2026-09-01', false) }));
    const env = await getGameWeather({ date: '2026-09-01', venue: 'Home', lat: 10, lon: 20 }, { fetch: f, now: NOW });
    expect(env.lat).toBe(10);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('surfaces Open-Meteo reason as upstream error', async () => {
    const f = mockFetch(() => ({ error: true, reason: 'Parameter start_date is out of allowed range' }));
    await expect(getGameWeather({ date: '2027-06-01', venue: 'Home' }, { fetch: f, now: NOW }))
      .rejects.toMatchObject({ constructor: WeatherUpstreamError, reason: 'Parameter start_date is out of allowed range' });
  });

  it('rejects bad input', async () => {
    const f = mockFetch(() => ({}));
    await expect(getGameWeather({ date: '9/5/2026' }, { fetch: f })).rejects.toBeInstanceOf(WeatherInputError);
    await expect(getGameWeather({ date: '2026-09-05', lat: 95, lon: 0 }, { fetch: f })).rejects.toBeInstanceOf(WeatherInputError);
    await expect(getGameWeather({ date: '2026-09-05', lat: 10 }, { fetch: f })).rejects.toBeInstanceOf(WeatherInputError);
    await expect(getGameWeather({ date: '2026-09-05', kickoff: '7pm', venue: 'Home' }, { fetch: f })).rejects.toBeInstanceOf(WeatherInputError);
    await expect(getGameWeather({ date: '2026-09-05' }, { fetch: f })).rejects.toBeInstanceOf(WeatherInputError);
    expect(f).not.toHaveBeenCalled();
  });

  it('uses fresh cache and skips fetch; refetches stale forecast', async () => {
    const store = new Map<string, { payload: HourlyPayload; fetched_at: string }>();
    const cache: WeatherCache = {
      get: async (k) => store.get(k) ?? null,
      set: async (k, payload) => { store.set(k, { payload, fetched_at: NOW.toISOString() }); },
    };
    const f = mockFetch(() => ({ hourly: hourly('2026-11-09') }));
    const deps = { fetch: f, now: NOW, cache };
    await getGameWeather({ date: '2026-11-09', venue: 'Home' }, deps);
    await getGameWeather({ date: '2026-11-09', venue: 'Home' }, deps);
    expect(f).toHaveBeenCalledTimes(1);
    expect(store.has(cacheKey(29.6447, -82.353, '2026-11-09'))).toBe(true);
    // 4h later the future-date forecast is stale
    await getGameWeather({ date: '2026-11-09', venue: 'Home' }, { ...deps, now: new Date(NOW.getTime() + 4 * 3600e3) });
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('cache freshness', () => {
  it('future forecast ≤3h, archive forever', () => {
    const at = NOW.toISOString();
    const later = (h: number) => new Date(NOW.getTime() + h * 3600e3);
    expect(isCacheFresh('forecast', '2026-11-10', at, later(2.9))).toBe(true);
    expect(isCacheFresh('forecast', '2026-11-10', at, later(3.1))).toBe(false);
    expect(isCacheFresh('archive', '2026-01-10', at, later(10_000))).toBe(true);
  });
});

describe('venues', () => {
  it('parses City, ST', () => {
    expect(parseCityState('Gainesville, Fla.')).toEqual({ city: 'Gainesville', state: 'Fla' });
    expect(parseCityState('Dumas Stadium, Gainesville, FL')).toEqual({ city: 'Gainesville', state: 'FL' });
    expect(parseCityState('Gainesville')).toBeNull();
  });
  it('disambiguates Columbia by state', () => {
    expect(findKnownVenue('Columbia, SC')?.school).toBe('South Carolina');
    expect(findKnownVenue('Columbia, MO')?.school).toBe('Missouri');
    expect(findKnownVenue('Columbia, MD')).toBeNull();
  });
});

describe('mergeEnv', () => {
  const fetched = { tempF: 80, dewF: 70, rh: 60, uv: 3, windMph: 4, precipIn: 0, lat: 1, lon: 2, src: 'open-meteo', kickoff: '19:00', kickoffSrc: 'default (19:00)' };
  it('fills only nulls and preserves kickoff', () => {
    const out = mergeEnv({ kickoff: '13:00', kickoffSrc: 'box score (local)', tempF: 91, dewF: null, src: 'manual' }, fetched);
    expect(out).toMatchObject({ kickoff: '13:00', kickoffSrc: 'box score (local)', tempF: 91, dewF: 70, uv: 3, src: 'manual+open-meteo' });
  });
  it('force overwrites values but still keeps kickoff', () => {
    const out = mergeEnv({ kickoff: '13:00', tempF: 91 }, fetched, true);
    expect(out).toMatchObject({ kickoff: '13:00', tempF: 80, src: 'open-meteo' });
  });
  it('uses fetched default kickoff when none', () => {
    expect(mergeEnv(undefined, fetched)).toMatchObject({ kickoff: '19:00', kickoffSrc: 'default (19:00)', src: 'open-meteo' });
  });
});

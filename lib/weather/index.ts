// Weather client API. OWNED BY AGENT D. Calls /api/weather (server proxies Open-Meteo + caches).
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { GameEnv } from '@/lib/types';

export interface WeatherQuery { date: string; kickoff?: string; location?: string; venue?: string; lat?: number; lon?: number }

/** Returns env fields at kickoff hour (tempF, dewF, rh, uv, windMph, precipIn, lat, lon, src:'open-meteo'). */
export async function fetchGameWeather(q: WeatherQuery): Promise<GameEnv> { throw new Error('fetchGameWeather: not implemented'); }

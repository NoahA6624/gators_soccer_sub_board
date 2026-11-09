// Known venue coordinates (approximate soccer-field locations). OWNED BY AGENT D.
// Lookup order in openmeteo.ts: explicit lat/lon > this table > Open-Meteo geocoding.

export interface KnownVenue {
  school: string;
  stadium: string;
  city: string;
  state: string; // 2-letter
  lat: number;
  lon: number;
  /** Extra lowercase substrings that identify this venue in a free-text location. */
  aliases?: string[];
}

export const HOME_VENUE: KnownVenue = {
  school: 'Florida', stadium: 'Donald R. Dumas Stadium', city: 'Gainesville', state: 'FL',
  lat: 29.6447, lon: -82.353, aliases: ['dumas stadium', 'james g. pressly'],
};

export const KNOWN_VENUES: KnownVenue[] = [
  HOME_VENUE,
  { school: 'Alabama', stadium: 'Alabama Soccer Stadium', city: 'Tuscaloosa', state: 'AL', lat: 33.2155, lon: -87.539 },
  { school: 'Arkansas', stadium: 'Razorback Field', city: 'Fayetteville', state: 'AR', lat: 36.0687, lon: -94.1748 },
  { school: 'Auburn', stadium: 'Auburn Soccer Complex', city: 'Auburn', state: 'AL', lat: 32.59, lon: -85.505 },
  { school: 'Georgia', stadium: 'Turner Soccer Complex', city: 'Athens', state: 'GA', lat: 33.939, lon: -83.378 },
  { school: 'Kentucky', stadium: 'Wendell & Vickie Bell Soccer Complex', city: 'Lexington', state: 'KY', lat: 38.021, lon: -84.505 },
  { school: 'LSU', stadium: 'LSU Soccer Stadium', city: 'Baton Rouge', state: 'LA', lat: 30.41, lon: -91.183 },
  { school: 'Ole Miss', stadium: 'Ole Miss Soccer Stadium', city: 'Oxford', state: 'MS', lat: 34.364, lon: -89.539 },
  { school: 'Mississippi State', stadium: 'MSU Soccer Field', city: 'Starkville', state: 'MS', lat: 33.456, lon: -88.793 },
  { school: 'Missouri', stadium: 'Walton Stadium', city: 'Columbia', state: 'MO', lat: 38.931, lon: -92.333 },
  { school: 'Oklahoma', stadium: 'John Crain Field', city: 'Norman', state: 'OK', lat: 35.195, lon: -97.443 },
  { school: 'South Carolina', stadium: 'Stone Stadium', city: 'Columbia', state: 'SC', lat: 33.974, lon: -81.023 },
  { school: 'Tennessee', stadium: 'Regal Soccer Stadium', city: 'Knoxville', state: 'TN', lat: 35.945, lon: -83.938 },
  { school: 'Texas', stadium: 'Mike A. Myers Stadium', city: 'Austin', state: 'TX', lat: 30.283, lon: -97.732 },
  { school: 'Texas A&M', stadium: 'Ellis Field', city: 'College Station', state: 'TX', lat: 30.605, lon: -96.348 },
  { school: 'Vanderbilt', stadium: 'Vanderbilt Soccer Complex', city: 'Nashville', state: 'TN', lat: 36.144, lon: -86.809 },
];

const norm = (s: string) => s.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();

/** Parse "City, ST" (or "City, State Name") from a free-text location. Returns null if no comma pair. */
export function parseCityState(location: string | undefined | null): { city: string; state: string } | null {
  if (!location) return null;
  // Use the last "X, Y" pair so "Dumas Stadium, Gainesville, FL" → Gainesville / FL.
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const state = parts[parts.length - 1].replace(/\s*\d{5}(-\d{4})?$/, '').replace(/\./g, '').trim();
  const city = parts[parts.length - 2].trim();
  if (!city || !state) return null;
  return { city, state: state.length === 2 ? state.toUpperCase() : state };
}

/** Find a known venue from a free-text location / venue string. */
export function findKnownVenue(location?: string | null, venue?: string | null): KnownVenue | null {
  const text = norm([location, venue].filter(Boolean).join(' '));
  if (text) {
    for (const v of KNOWN_VENUES) {
      if (norm(v.stadium) && text.includes(norm(v.stadium))) return v;
      if (v.aliases?.some((a) => text.includes(norm(a)))) return v;
    }
    const cs = parseCityState(location);
    if (cs) {
      const hit = KNOWN_VENUES.find((v) => norm(v.city) === norm(cs.city) && v.state === cs.state.toUpperCase());
      if (hit) return hit;
    }
  }
  // A Home game with no usable location is at Dumas Stadium.
  if (!location && venue === 'Home') return HOME_VENUE;
  return null;
}

// Role groups for full-match lanes (L833–835 of the original).
export const ROLES: [key: string, label: string, desc: string][] = [
  ['anchor', 'Anchors', 'Play (nearly) the full 90 — the full-match load benchmark'],
  ['long', 'One long spell', 'Start and stay on through halftime'],
  ['rotator', 'Two-spell starters', 'Start, come off in the 1st half, back on in the 2nd'],
  ['impact', 'Impact subs', 'Regular bench minutes, usually two spells'],
  ['spot', 'Spot minutes', 'Occasional or late minutes'],
  ['gk', 'Goalkeepers', ''],
];
export const roleLabel = (k: string) => ROLES.find((x) => x[0] === k)?.[1] ?? '';

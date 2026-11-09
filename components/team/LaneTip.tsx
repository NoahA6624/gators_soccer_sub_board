'use client';
// Tooltip body for a full-match lane row (laneTip, L834).
import { patternText, playerLabel, type Agg, type NameIndex } from '@/lib/engine';
import { fx, rnd, safe } from '@/components/ui';

export function LaneTipBody({ r, idx }: { r: Agg; idx: NameIndex }) {
  return (
    <>
      <b>{playerLabel(r.p, idx)}</b> · {rnd(r.minPg)} min/game
      <br />
      {safe(() => patternText(r), '')}
      <br />
      <span style={{ opacity: 0.8 }}>
        {r.g ?? 0} games · {r.starts ?? 0} starts · {fx(r.spellPg)} spells × {rnd(r.spellLen)}&apos; avg
        {r.full90 ? ` · ${r.full90} full 90s` : ''}
      </span>
    </>
  );
}

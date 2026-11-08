// Small SVG strips (port of strip/occStrip, L799–810).
//
//   <Strip points={[{m, g:{opp}}]} avg={avgMin} full={nFull} lo={0} hi={45} width={220} />
//     Dot per game on a lo–hi track, ink bar at avg, hollow blue dot at hi when `full` > 0 (×full).
//     Point minute is read from p.m ?? p.min. Wrap in <td class="strip"> for the table sizing.
//   <OccStrip occ={r.occ} n={games} width={200} />
//     18 five-minute blocks, opacity = share of games on the field (occ[b] / (5·n)); orange line at HT.
import { clk } from '@/lib/engine';
import { arr, isNum, subMin } from './util';

export interface StripPoint { m?: number; min?: number; g?: { opp?: string } }

export function Strip({ points, avg, full, lo, hi, width = 220 }: {
  points: StripPoint[] | undefined; avg?: number | null; full?: number; lo: number; hi: number; width?: number;
}) {
  const W = width, H = 24, x0 = 6, x1 = W - 6;
  const sx = (m: number) => x0 + (x1 - x0) * ((Math.min(Math.max(m, lo), hi) - lo) / (hi - lo));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect x={x0} y={H / 2 - 2} width={x1 - x0} height={4} rx={2} fill="var(--track)" />
      {[lo + 15, lo + 30].map((t) => (
        <line key={t} x1={sx(t)} x2={sx(t)} y1={H / 2 - 6} y2={H / 2 + 6} stroke="var(--line)" />
      ))}
      {arr<StripPoint>(points).map((p, i) => {
        const m = subMin(p as Record<string, number>);
        if (!isNum(m)) return null;
        return (
          <circle key={i} cx={sx(m)} cy={H / 2} r={4.5} fill="var(--orange)" fillOpacity={0.78}>
            <title>{`${p.g?.opp ?? ''} ${clk(m)}`}</title>
          </circle>
        );
      })}
      {!!full && (
        <circle cx={sx(hi)} cy={H / 2} r={5} fill="var(--surface)" stroke="var(--blue)" strokeWidth={2}>
          <title>{`Full half ×${full}`}</title>
        </circle>
      )}
      {isNum(avg) && <line x1={sx(avg)} x2={sx(avg)} y1={3} y2={H - 3} stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" />}
    </svg>
  );
}

export function OccStrip({ occ, n, width = 200 }: { occ: number[] | undefined; n: number; width?: number }) {
  const W = width, H = 20, bw = W / 18;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ width: W, maxWidth: '100%', height: H, display: 'block' }}>
      {arr<number>(occ).map((v, b) => {
        const sh = n ? Math.min(1, (v || 0) / (5 * n)) : 0;
        return (
          <g key={b}>
            <rect x={b * bw + 0.5} y={2} width={bw - 1} height={H - 4} rx={2} fill="var(--track)" />
            <rect x={b * bw + 0.5} y={2} width={bw - 1} height={H - 4} rx={2} fill="var(--blue)" fillOpacity={+(sh * 0.95).toFixed(2)}>
              <title>{`${b * 5}–${b * 5 + 5}': ${Math.round(sh * 100)}% of games`}</title>
            </rect>
          </g>
        );
      })}
      <line x1={9 * bw} x2={9 * bw} y1={0} y2={H} stroke="var(--orange)" strokeWidth={1.5} />
    </svg>
  );
}

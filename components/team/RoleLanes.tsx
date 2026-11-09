'use client';
// roleLanes (L837–843): full-match players grouped by role with a typical-match lane each.
import { roleOf, type Agg, type NameIndex } from '@/lib/engine';
import { LaneAxis, LaneSVG, PlayerName, rnd, safe, useTip } from '@/components/ui';
import { ROLES } from './roles';
import { LaneTipBody } from './LaneTip';

export function RoleLanes({ FP, idx, posFor, onPick }: {
  FP: Agg[]; idx: NameIndex; posFor: (p: string) => string; onPick?: (p: string) => void;
}) {
  const tip = useTip();
  const groups = ROLES.map(([k, l, d]) => ({
    k, l, d,
    rows: FP.filter((r) => (r.g ?? 0) > 0 && safe(() => roleOf(r), 'spot') === k).sort((a, b) => (b.minPg ?? 0) - (a.minPg ?? 0)),
  })).filter((x) => x.rows.length);
  if (!groups.length) return <p className="note">No players in these games.</p>;
  return (
    <>
      {groups.map((gr) => (
        <div className="role" key={gr.k}>
          <div className="role-h"><b>{gr.l}</b><span>{gr.d}</span></div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Player</th>
                  <th style={{ width: 70 }}>Min/g</th>
                  <th style={{ width: 60 }}>Games</th>
                  <th style={{ minWidth: 420, width: '60%' }}><LaneAxis /></th>
                </tr>
              </thead>
              <tbody>
                {gr.rows.map((r) => (
                  <tr key={r.p} className="click" onClick={() => onPick?.(r.p)} {...tip(<LaneTipBody r={r} idx={idx} />)}>
                    <td><PlayerName p={r.p} idx={idx} pos={posFor(r.p)} /></td>
                    <td className="tnum big">{rnd(r.minPg)}</td>
                    <td className="tnum">{r.g}<span className="dim"> · {r.starts ?? 0} st</span></td>
                    <td style={{ paddingBlock: 4 }}><LaneSVG r={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

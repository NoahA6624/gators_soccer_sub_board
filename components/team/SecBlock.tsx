'use client';
// secBlock (L1416): SEC vs non-conference comparison, shown when the Opponent filter is SEC.
import { useMemo } from 'react';
import { useBoard } from '@/lib/data/board';
import { dm, fullPlayerStats, fullTeamStats, isSEC, posOf, teamStats, type Agg, type NameIndex } from '@/lib/engine';
import { byP, isNum, PlayerName, safe, SectionLabel, toList } from '@/components/ui';

const f1 = (v: number) => v.toFixed(1);
type Row = [label: string, get: (x: Agg) => unknown, fmt: (v: number) => string, unit?: 1];
const ROWS: Row[] = [
  ['1H first sub', (x) => x.a.first, (v) => dm(v), 1],
  ['1H subs / game', (x) => x.a.perGame, f1],
  ["1H outfield starters going 45'", (x) => x.a.full, f1],
  ['Halftime changes / game', (x) => x.F.ht, f1],
  ['2H first in-play sub', (x) => x.b.first, (v) => dm(v), 1],
  ['2H in-play subs / game', (x) => x.b.perGame, f1],
  ['Players used / game', (x) => x.F.used, f1],
  ['Outfield full 90s / game', (x) => x.F.f90, f1],
];

export function SecBlock({ idx }: { idx: NameIndex }) {
  const { games, roster, loads, filters } = useBoard();
  const data = useMemo(() => {
    if (filters.tier !== 'SEC') return null;
    const sec = games.filter((g) => safe(() => isSEC(g), false));
    const non = games.filter((g) => !safe(() => isSEC(g), false));
    if (!sec.length || !non.length) return null;
    const pack = (gs: typeof games) => ({
      a: safe(() => teamStats(gs, 1), {}), b: safe(() => teamStats(gs, 2), {}), F: safe(() => fullTeamStats(gs), {}),
    });
    const PS = toList(safe(() => fullPlayerStats(sec, loads), []));
    const PN = byP(safe(() => fullPlayerStats(non, loads), []));
    return { sec, non, A: pack(sec), B: pack(non), PS, PN };
  }, [games, loads, filters.tier]);
  if (!data) return null;
  const { sec, non, A, B, PS, PN } = data;
  const pos = (p: string) => safe(() => posOf(p, games, roster), '');
  const pl = PS.filter((r) => pos(r.p) !== 'GK').sort((a, b) => (b.minPg ?? 0) - (a.minPg ?? 0));
  const bar = (v: number, c: string) => (
    <div style={{ height: 9, borderRadius: 5, background: 'var(--track)', width: 130, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, ((v || 0) / 90) * 100)}%`, background: c, borderRadius: 5 }} />
    </div>
  );
  return (
    <>
      <SectionLabel>SEC vs non-conference</SectionLabel>
      <div className="grid2">
        <section className="panel">
          <h3>How we manage SEC games</h3>
          <div className="tablewrap">
            <table className="cmp">
              <thead><tr><th>Measure</th><th>SEC ({sec.length})</th><th>Non-conf ({non.length})</th><th>Difference</th></tr></thead>
              <tbody>
                {ROWS.map(([l, fn, f, unit]) => {
                  const a = safe(() => fn(A), null), b = safe(() => fn(B), null);
                  const d = isNum(a) && isNum(b) ? a - b : null;
                  return (
                    <tr key={l}>
                      <td>{l}</td>
                      <td className="tnum big">{isNum(a) ? f(a) : '—'}</td>
                      <td className="tnum">{isNum(b) ? f(b) : '—'}</td>
                      <td className={`tnum ${d == null || Math.abs(d) < 0.05 ? '' : d > 0 ? 'up' : 'dn'}`}>
                        {d == null ? '—' : (d > 0 ? '+' : '') + d.toFixed(1) + (unit ? "'" : '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h3>Who carries more in SEC play · minutes per game</h3>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Player</th><th>SEC</th><th /><th>Non-conf</th><th>Δ</th></tr></thead>
              <tbody>
                {pl.map((r) => {
                  const o = PN[r.p];
                  const nm = o?.minPg ?? 0;
                  const d = (r.minPg ?? 0) - nm;
                  return (
                    <tr key={r.p}>
                      <td><PlayerName p={r.p} idx={idx} pos={pos(r.p)} /></td>
                      <td className="tnum big">{Math.round(r.minPg ?? 0)}</td>
                      <td>{bar(r.minPg, 'var(--blue)')}<div style={{ height: 3 }} />{bar(nm, 'var(--opp)')}</td>
                      <td className="tnum">{o ? Math.round(nm) : '—'}</td>
                      <td className={`tnum ${Math.abs(d) < 3 ? '' : d > 0 ? 'delta-up' : 'delta-dn'}`}>{o ? (d > 0 ? '+' : '') + Math.round(d) : 'new'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">Blue = SEC, grey = non-conference. Large positive numbers = load climbs in conference play.</p>
        </section>
      </div>
    </>
  );
}

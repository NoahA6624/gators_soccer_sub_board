'use client';
// renderTeamHalf (L899–935) + contextRows (L895).
import { useMemo } from 'react';
import { useBoard } from '@/lib/data/board';
import { dm, filtered, HN, insights, isSEC, teamStats, type Agg } from '@/lib/engine';
import type { Game } from '@/lib/types';
import { arr, FilterBar, fx, InsightList, Kpi, ScopeLine, SectionLabel, safe, useNameIndex } from '@/components/ui';
import { Histo, StateBars, WindowRows } from './charts';
import { SecBlock } from './SecBlock';

const CTX: [string, (g: Game) => boolean][] = [
  ['All games', () => true], ['Power 4', (g) => g.tier === 'P4'], ['SEC', (g) => safe(() => isSEC(g), false)],
  ['Non-P4', (g) => g.tier === 'Non-P4'], ['Wins', (g) => g.result === 'W'], ['Ties', (g) => g.result === 'T'],
  ['Losses', (g) => g.result === 'L'], ['Home', (g) => g.venue === 'Home'], ['Away', (g) => g.venue === 'Away'],
];

const r10 = (n: unknown, m: unknown) => (typeof n === 'number' && typeof m === 'number' && m ? ((n / m) * 10).toFixed(2) : '—');

export function TeamHalf({ h }: { h: 1 | 2 }) {
  const { games: all, filters } = useBoard();
  const idx = useNameIndex();
  const games = useMemo(() => safe(() => filtered(all, filters), all), [all, filters]);
  const T: Agg = useMemo(() => safe(() => teamStats(games, h), {}), [games, h]);
  const ins = useMemo(() => arr<string>(safe(() => insights(games, h), [])), [games, h]);
  const ctx = useMemo(
    () => CTX.map(([l, fn]) => { const gs = all.filter(fn); return { l, n: gs.length, T: gs.length ? safe(() => teamStats(gs, h), {} as Agg) : ({} as Agg) }; }).filter((r) => r.n),
    [all, h],
  );
  const hn = HN[h === 1 ? 'h1' : 'h2'];
  const R: Agg = T.rate ?? {};
  const pre: Agg = T.pre ?? {}, post: Agg = T.post ?? {};
  const k2 = h === 2;

  return (
    <>
      <FilterBar />
      <ScopeLine games={games} />
      {!all.length ? (
        <div className="panel empty">No games yet. Add a game to get started.</div>
      ) : !games.length ? (
        <div className="panel empty">No games match these filters.</div>
      ) : (
        <div className="stack">
          <div className="kpis">
            {k2 && <Kpi v={fx(T.ht)} k="Halftime changes / game" />}
            <Kpi v={dm(T.first)} k={`Avg first ${k2 ? 'in-play ' : ''}sub`} />
            <Kpi v={dm(T.last)} k="Avg last sub" />
            <Kpi v={fx(T.perGame)} k={`${k2 ? 'In-play subs' : 'Subs'} / game`} />
            {!k2 && <Kpi v={fx(T.moments)} k="Sub moments / game" />}
            <Kpi v={fx(T.full)} k={`Outfield on ${k2 ? 'at restart' : 'at start'} who go the full half`} />
            <Kpi v={dm(T.oppFirst)} k={`Opponent first ${k2 ? 'in-play ' : ''}sub`} />
          </div>
          <div className="gridW">
            <section className="panel fill">
              <h3>When we sub · {hn}, 5-minute windows <span className="dim" style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>· hover a bar for who came off</span></h3>
              <div className="chart"><Histo T={T} idx={idx} /></div>
            </section>
            <section className="panel">
              <h3>Score when we sub</h3>
              <StateBars T={T} />
              <h3 style={{ marginTop: 20 }}>Each 15 minutes · shots and goals</h3>
              <WindowRows T={T} />
            </section>
          </div>
          <section className="panel">
            <h3>Sub pattern by context · all games · {hn}</h3>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Context</th><th>Games</th>{k2 && <th>HT changes</th>}<th>First sub</th><th>Last sub</th><th>Subs / g</th><th>Moments / g</th><th>Outfield full half / g</th><th>Opp first sub</th>
                  </tr>
                </thead>
                <tbody>
                  {ctx.map((c) => (
                    <tr key={c.l}>
                      <td><b>{c.l}</b></td>
                      <td className="tnum">{c.n}</td>
                      {k2 && <td className="tnum">{fx(c.T.ht)}</td>}
                      <td className="big tnum">{dm(c.T.first)}</td>
                      <td className="tnum">{dm(c.T.last)}</td>
                      <td className="tnum">{fx(c.T.perGame)}</td>
                      <td className="tnum">{fx(c.T.moments)}</td>
                      <td className="tnum">{fx(c.T.full)}</td>
                      <td className="tnum">{dm(c.T.oppFirst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <SecBlock idx={idx} />
          <SectionLabel>Supplemental analysis</SectionLabel>
          <div className="grid2">
            <section className="panel">
              <h3>Takeaways · {hn}</h3>
              <InsightList items={ins} idx={idx} />
            </section>
            <section className="panel">
              <h3>Around our subs · shots per 10 min</h3>
              <div className="tablewrap">
                <table>
                  <thead><tr><th /><th>FL shots</th><th>Opp shots</th><th>GF</th><th>GA</th></tr></thead>
                  <tbody>
                    <tr><td>Before first sub</td><td className="tnum big">{r10(R.bU, R.bM)}</td><td className="tnum big">{r10(R.bO, R.bM)}</td><td className="tnum">{R.bGU ?? '—'}</td><td className="tnum">{R.bGO ?? '—'}</td></tr>
                    <tr><td>After first sub</td><td className="tnum big">{r10(R.aU, R.aM)}</td><td className="tnum big">{r10(R.aO, R.aM)}</td><td className="tnum">{R.aGU ?? '—'}</td><td className="tnum">{R.aGO ?? '—'}</td></tr>
                    <tr><td>10 min before each sub moment</td><td className="tnum">{r10(pre.u, pre.m)}</td><td className="tnum">{r10(pre.o, pre.m)}</td><td className="dim">—</td><td className="dim">—</td></tr>
                    <tr><td>10 min after each sub moment</td><td className="tnum">{r10(post.u, post.m)}</td><td className="tnum">{r10(post.o, post.m)}</td><td className="dim">—</td><td className="dim">—</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="note">Team numbers. Game state and fatigue are mixed in: signals to check against GPS, not proof.</p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

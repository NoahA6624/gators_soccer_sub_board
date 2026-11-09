'use client';
// renderTeamFull (L972–999) + fullInsights (L958).
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useBoard } from '@/lib/data/board';
import { dm, filtered, fullInsights, fullPlayerStats, fullTeamStats, posOf, teamStats, type Agg } from '@/lib/engine';
import { arr, FilterBar, fx, InsightList, Kpi, LaneLegend, ScopeLine, SectionLabel, safe, toList, useNameIndex } from '@/components/ui';
import { FreshChart, RotationMap } from './charts';
import { RoleLanes } from './RoleLanes';
import { SecBlock } from './SecBlock';
import { usePlayersUi } from './playersUi';

export function TeamFull() {
  const { games: all, loads, roster, filters } = useBoard();
  const idx = useNameIndex();
  const router = useRouter();
  const [, setPui] = usePlayersUi();
  const games = useMemo(() => safe(() => filtered(all, filters), all), [all, filters]);
  const T1: Agg = useMemo(() => safe(() => teamStats(games, 1), {}), [games]);
  const FT: Agg = useMemo(() => safe(() => fullTeamStats(games), {}), [games]);
  const FP = useMemo(() => toList(safe(() => fullPlayerStats(games, loads), [])), [games, loads]);
  const ins = useMemo(() => arr<string>(safe(() => fullInsights(games), [])), [games]);
  const posFor = (p: string) => safe(() => posOf(p, all, roster), '');
  const pick = (p: string) => {
    setPui({ player: p });
    router.push('/players');
  };

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
            <Kpi v={dm(T1.first)} k="First sub (1H)" />
            <Kpi v={fx(FT.ht)} k="Halftime changes / game" />
            <Kpi v={dm(FT.first2)} k="First in-play 2H sub" />
            <Kpi v={fx(FT.used)} k="Players used / game" />
            <Kpi v={fx(FT.spellsPg)} k="Spells per player / game" />
            <Kpi v={fx(FT.f90)} k="Outfield full 90s / game" />
          </div>
          <section className="panel">
            <h3>Typical match by role · average spells across these games</h3>
            <RoleLanes FP={FP} idx={idx} posFor={posFor} onPick={pick} />
            <LaneLegend />
          </section>
          <section className="panel">
            <h3>Rotation map · share of games each player is on the field, 5-minute blocks</h3>
            <div className="chart" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}><RotationMap FP={FP} n={games.length} idx={idx} /></div>
            </div>
          </section>
          <div className="grid2">
            <section className="panel">
              <h3>15-minute windows · full match</h3>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Window</th><th>In-play subs</th><th>FL shots</th><th>Opp shots</th><th>Goals</th></tr></thead>
                  <tbody>
                    {arr(FT.win).map((w) => (
                      <tr key={w.a}>
                        <td>{w.a}–{w.b}&apos;</td>
                        <td className="tnum">{w.subs ?? 0}</td>
                        <td className="tnum big">{w.f ?? 0}</td>
                        <td className="tnum big">{w.o ?? 0}</td>
                        <td className="tnum">{w.gf ?? 0}–{w.ga ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 style={{ marginTop: 16 }}>Halftime changes by game</h3>
              <div className="chips">
                {arr(FT.htBy).map((x, i) => (
                  <span className="chip" key={x.g?.id ?? i}>
                    <span className={`res-${x.g?.result}`}>{x.g?.result}</span> {x.g?.opp} <b className="tnum">{x.n}</b>
                  </span>
                ))}
              </div>
            </section>
            <section className="panel">
              <h3>Team shots by minutes into players&apos; spells</h3>
              <div className="chart"><FreshChart W={FT.W} /></div>
              <div className="legend">
                <span><i className="sw" style={{ background: 'var(--blue)' }} />Florida shots / 90</span>
                <span><i className="sw" style={{ background: 'var(--opp)' }} />Opponent shots / 90</span>
              </div>
              <p className="note">Clock starts at entry or a restart (halftime resets it). Weighted by player-minutes across the team.</p>
            </section>
          </div>
          <SecBlock idx={idx} />
          <SectionLabel>Supplemental analysis</SectionLabel>
          <section className="panel">
            <h3>Takeaways · full match</h3>
            <InsightList items={ins} idx={idx} />
          </section>
        </div>
      )}
    </>
  );
}

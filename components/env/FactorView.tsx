'use client';
// One-factor split view (renderEnv L1801–1871, pairBars L1743, impactList L1750, takeaways L1843–1854).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, type ReactNode } from 'react';
import type { Game } from '@/lib/types';
import { useTip } from './Tip';
import { PanelBoundary } from './ErrorBoundary';
import { CondCards, EnvRank, HeatChart } from './EnvParts';
import { players as envP, rank as envR, team as envT } from './envEngine';
import { EFACT, eLab, env, envSelLabel, eShort, type EnvUi, type FactorKey } from './envUtil';

type Agg = Record<string, any>;
const num = (v: unknown): v is number => typeof v === 'number' && !isNaN(v);
const R = (v: unknown) => (num(v) ? Math.round(v) : '—');
const sg = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v));

export function FactorView({ u, set, all, games, canEdit, lab, posOf, condEditor }: {
  u: EnvUi; set: (p: Partial<EnvUi>) => void; all: Game[]; games: Game[]; canEdit: boolean;
  lab: (p: string) => string; posOf: (p: string) => string; condEditor: ReactNode;
}) {
  const tip = useTip();
  const fk = u.efac as FactorKey, f = EFACT[fk], eh = u.eheat;
  const A = all.filter((g) => f.grp(g, games, eh) === 'A'), B = all.filter((g) => f.grp(g, games, eh) === 'B'), X = all.filter((g) => !f.grp(g, games, eh));
  const noWx = games.filter((g) => env(g).heat == null).length;
  const LA = eShort(fk, 'A', eh), LB = eShort(fk, 'B', eh), LAl = eLab(fk, 'A', eh), LBl = eLab(fk, 'B', eh);
  const posTag = (p: string) => { const x = posOf(p); return x ? <> <span className="pos">{x}</span></> : null; };

  const data = useMemo(() => {
    if (!A.length || !B.length) return null;
    const TA = envT(A, fk, eh), TB = envT(B, fk, eh);
    const P = envP(all, fk, A, B, eh);
    return { TA, TB, P, rows: envR(all, P, fk, eh) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, games, fk, eh]);

  const cards = (
    <section className="panel">
      <h3>Match conditions · <span style={{ color: 'var(--bench-st)' }}>■</span> {LAl} &nbsp;<span style={{ color: 'var(--orange)' }}>■</span> {LBl}</h3>
      <CondCards all={all} games={games} fk={fk} eheat={eh} />
    </section>
  );

  if (!data) {
    return (
      <>
        {cards}
        <section className="panel empty">
          {fk === 'heat' && noWx
            ? <>Heat needs a kickoff temperature. {noWx} of {games.length} matches don&apos;t have them yet.{canEdit ? <> Enter them in <b>Match conditions</b> below.</> : ' An editor can add them.'}</>
            : <>This split needs matches on both sides. Right now: {A.length} {LAl}, {B.length} {LBl}{X.length ? `, ${X.length} unclassified` : ''}.</>}
        </section>
        {condEditor}
      </>
    );
  }

  const { TA, TB, P, rows } = data;
  const ok = P.filter((r) => r.ok && posOf(r.p) !== 'GK');
  const up = ok.filter((r) => r.dMin >= 3).sort((a, b) => b.dMin - a.dMin).slice(0, 6);
  const dn = ok.filter((r) => r.dMin <= -3).sort((a, b) => a.dMin - b.dMin).slice(0, 6);
  const sh = ok.filter((r) => r.absLen >= 3).sort((a, b) => b.absLen - a.absLen).slice(0, 6);
  const mix = (T: Agg) => `${T.W}-${T.T}-${T.L} · ${T.p4}/${T.n} Power 4${fk !== 'venue' ? ` · ${T.home}/${T.n} home` : ''}${fk !== 'time' ? ` · ${T.night}/${T.n} night` : ''}`;

  // pairBars
  const PB: [string, string, (v: number) => string, string][] = [
    ['In-play subs per game', 'ip', (v) => v.toFixed(1), ''], ['Minute of first sub', 'first', (v) => Math.round(v) + "'", 'Earlier = quicker hook'],
    ['Players used per game', 'used', (v) => v.toFixed(1), ''], ['Outfield full 90s per game', 'f90', (v) => v.toFixed(1), ''],
    ['Starter minutes (outfield avg)', 'stMin', (v) => Math.round(v) + "'", ''], ['Average spell length', 'len', (v) => Math.round(v) + "'", 'Outfield, every spell'],
  ];
  const bar = (v: unknown, mx: number, c: string, fmt: (v: number) => string) => (
    <div className="ebar"><div className="trk"><i style={{ width: `${num(v) ? ((v / mx) * 100).toFixed(1) : 0}%`, background: c }} /></div><span className="tnum">{num(v) ? fmt(v) : '—'}</span></div>
  );

  const impactList = (list: Agg[], title: string, cls: string, fmt: (r: Agg) => string) => (
    <div className="elist"><h4 className={cls}>{title}</h4>
      {list.length ? <ol>{list.map((r) => (
        <li key={r.p} {...tip(<>
          <b>{lab(r.p)}</b><br />
          <b>{LA}</b> ({r.A.apps}): {R(r.A.mpa)}&apos; per app · {num(r.A.spa) ? r.A.spa.toFixed(1) : '—'} spells × {R(r.A.len)}&apos;<br />
          <b>{LB}</b> ({r.B.apps}): {R(r.B.mpa)}&apos; per app · {num(r.B.spa) ? r.B.spa.toFixed(1) : '—'} spells × {R(r.B.len)}&apos;
          <div className="tl">{(r.B.games ?? []).map((x: string, i: number) => <span key={i}>{x}</span>)}</div>
        </>)}><span className="pname">{lab(r.p)}</span>{posTag(r.p)}<span className={`ev ${cls}`}>{fmt(r)}</span></li>
      ))}</ol> : <p className="note">No clear shifts with 2+ matches on each side.</p>}
    </div>
  );

  // table
  const cols: [string, ReactNode][] = [['p', 'Player'], ['appsT', <>Apps <span className="dim">{LA} / {LB}</span></>], ['mA', `Min/app ${LA}`], ['mB', `Min/app ${LB}`],
    ['abs', 'Minutes shift'], ['lenB', `Spell ${LB}`], ['absLen', 'Spell shift'], ['dExit', 'Starter 1st exit'], ['totB', `Total min ${LB}`]];
  const { key: k, dir: dd } = u.esort;
  const tRows = P.filter((r) => r.A.apps + r.B.apps > 0).sort((a, b) => (+b.ok - +a.ok) || (() => {
    const x = k === 'p' ? lab(a.p) : a[k], y = k === 'p' ? lab(b.p) : b[k];
    return (typeof x === 'string' ? x.localeCompare(y) : (x ?? -999) - (y ?? -999)) * dd;
  })() || b.abs - a.abs);
  const maxD = Math.max(10, ...ok.map((r) => r.abs || 0));
  const div = (v: unknown) => {
    if (!num(v)) return <span className="dim">—</span>;
    const w = Math.min(50, (Math.abs(v) / maxD) * 50);
    return <div className="dbar"><div className="trk"><i style={v >= 0 ? { left: '50%', width: `${w}%`, background: 'var(--orange)' } : { right: '50%', width: `${w}%`, background: 'var(--bench-st)' }} /><b /></div>
      <span className={`tnum ${v >= 3 ? 'delta-dn' : v <= -3 ? 'delta-up' : ''}`}>{sg(v)}&apos;</span></div>;
  };
  const sortBy = (key: string) => set({ esort: u.esort.key === key ? { key, dir: (-u.esort.dir) as 1 | -1 } : { key, dir: key === 'p' ? 1 : -1 } });

  // takeaways
  const tk: ReactNode[] = [];
  const dIp = (TB.ip ?? 0) - (TA.ip ?? 0), dSt = (TB.stMin ?? 0) - (TA.stMin ?? 0), dFirst = (TB.first ?? 0) - (TA.first ?? 0);
  const names = (l: Agg[], f2: (r: Agg) => string) => l.slice(0, 3).map((r, i) => <span key={r.p}>{i ? ', ' : ''}<b>{lab(r.p)}</b> ({f2(r)})</span>);
  tk.push(<>In <b>{LBl}</b> matches ({TB.n}) we made <b>{Math.abs(dIp).toFixed(1)} {dIp >= 0 ? 'more' : 'fewer'}</b> in-play subs per game than in {LAl} ({TA.n}), {Math.abs(dFirst) < 1 ? 'with the first sub at about the same minute' : <>and the first sub came <b>{Math.abs(Math.round(dFirst))}&apos; {dFirst < 0 ? 'earlier' : 'later'}</b></>}.</>);
  tk.push(<>Outfield starters averaged <b>{R(TB.stMin)}&apos;</b> vs <b>{R(TA.stMin)}&apos;</b>. {dSt >= 3 ? 'Starters carry more of the load in this condition.' : dSt <= -3 ? 'The load is spread wider in this condition.' : 'Starter load is about the same.'}</>);
  if (up.length) tk.push(<>Most added minutes in {LBl}: {names(up, (r) => sg(r.dMin) + "'")}. Check their {fk === 'venue' ? 'travel-week' : fk === 'heat' ? 'heat-day' : fk === 'week' ? 'two-match-week' : 'day-game'} HSR and total distance against their norms in STATSports.</>);
  if (dn.length) tk.push(<>Minutes held back in {LBl}: {names(dn, (r) => sg(r.dMin) + "'")}. Worth checking whether this is load management or a matchup choice.</>);
  if (sh.length) tk.push(<>Biggest change in spell length: {names(sh, (r) => `${R(r.A.len)}' → ${R(r.B.len)}'`)}. Shorter spells usually mean higher intensity per minute.</>);
  if (TA.n && TB.n && Math.abs(TA.p4 / TA.n - TB.p4 / TB.n) >= 0.25) tk.push(<><span className="warn">Opponent mix differs</span>: {TB.p4}/{TB.n} {LBl} matches were against Power 4 vs {TA.p4}/{TA.n} {LAl}. Use the Power 4 filter to take opponent strength out of the comparison.</>);
  if (fk !== 'time' && TA.n && TB.n && Math.abs(TA.night / TA.n - TB.night / TB.n) >= 0.34) tk.push(<><span className="warn">Kickoff time overlaps</span>: {TB.n - TB.night}/{TB.n} {LBl} matches were day games vs {TA.n - TA.night}/{TA.n} {LAl}. Some of this split is the Early vs Night effect.</>);
  if (fk === 'heat' && X.length) tk.push(<>{X.length} match{X.length > 1 ? 'es' : ''} without a kickoff temperature {X.length > 1 ? 'are' : 'is'} left out ({X.map((g) => g.opp).join(', ')}).</>);
  if (TA.n < 3 || TB.n < 3) tk.push(<><span className="warn">Small sample</span>: {Math.min(TA.n, TB.n)} match{Math.min(TA.n, TB.n) === 1 ? '' : 'es'} on one side. Treat these as leads to check, not conclusions.</>);

  return (
    <>
      {cards}
      {fk === 'heat' && <HeatChart all={all} eheat={eh} />}
      <PanelBoundary what="the ranking">
        <EnvRank fk={fk} rows0={rows} label={envSelLabel(u, all.length)} nA0={A.length} nB0={B.length} lab={lab}
          flip={!!u.eflip[fk]} setFlip={(v) => set({ eflip: { ...u.eflip, [fk]: v } })} />
      </PanelBoundary>
      <div className="grid2">
        <section className="panel"><h3>How we sub · per game</h3>
          <div className="ehead"><span /><span><i className="sw" style={{ background: 'var(--bench-st)' }} /> {LAl} <span className="dim">({TA.n})</span></span><span><i className="sw" style={{ background: 'var(--orange)' }} /> {LBl} <span className="dim">({TB.n})</span></span></div>
          {PB.map(([l, key, fmt, hint]) => {
            const mx = Math.max(num(TA[key]) ? TA[key] : 0, num(TB[key]) ? TB[key] : 0) || 1;
            return <div className="erow" key={key}><div className="el">{l}{hint && <span className="dim"> · {hint}</span>}</div>{bar(TA[key], mx, 'var(--bench-st)', fmt)}{bar(TB[key], mx, 'var(--orange)', fmt)}</div>;
          })}
          <p className="note" style={{ marginTop: 10 }}><b style={{ color: 'var(--bench-st)' }}>{LA}</b> {mix(TA)}<br /><b style={{ color: 'var(--orange)' }}>{LB}</b> {mix(TB)}</p>
        </section>
        <section className="panel"><h3>Most impacted players · {LBl} vs {LAl}</h3>
          <div className="elists">
            {impactList(up, `More minutes when ${LB}`, 'up', (r) => `${sg(r.dMin)}'`)}
            {impactList(dn, `Fewer minutes when ${LB}`, 'dn', (r) => `${sg(r.dMin)}'`)}
            {impactList(sh, 'Spell length changes most', 'sh', (r) => `${R(r.A.len)}'→${R(r.B.len)}'`)}
          </div>
          <p className="note" style={{ marginTop: 8 }}>Minutes per appearance, outfield players with 2+ appearances on each side. Hover a name for her matches.</p>
        </section>
      </div>
      <section className="panel"><h3>Every player · {LBl} vs {LAl}</h3>
        <div className="tablewrap"><table>
          <thead><tr>{cols.map(([key, l]) => (
            <th key={key} className="sortable" style={key === 'p' ? { textAlign: 'left' } : undefined} onClick={() => sortBy(key)}>
              {l} {u.esort.key === key && <span className="dir">{u.esort.dir === -1 ? '↓' : '↑'}</span>}
            </th>
          ))}</tr></thead>
          <tbody>{tRows.map((r) => (
            <tr key={r.p} className={r.ok ? '' : 'thin'} {...tip(<>
              <b>{lab(r.p)}</b>{!r.ok && <><br /><i>Fewer than 2 matches on one side: read with care</i></>}<br />
              <b>{LA}</b> · {r.A.apps} apps{r.A.apps ? ` · ${num(r.A.spa) ? r.A.spa.toFixed(1) : '—'} spells/app` : ''}{num(r.A.exit) ? ` · 1st exit ${Math.round(r.A.exit)}'` : ''}<br />
              <b>{LB}</b> · {r.B.apps} apps{r.B.apps ? ` · ${num(r.B.spa) ? r.B.spa.toFixed(1) : '—'} spells/app` : ''}{num(r.B.exit) ? ` · 1st exit ${Math.round(r.B.exit)}'` : ''}
            </>)}>
              <td style={{ textAlign: 'left' }}><span className="pname">{lab(r.p)}</span>{posTag(r.p)}</td>
              <td className="tnum">{r.A.apps} / {r.B.apps}</td>
              <td className="tnum">{num(r.A.mpa) ? `${Math.round(r.A.mpa)}'` : <span className="dim">—</span>}</td>
              <td className="tnum big" style={{ color: 'var(--orange)' }}>{num(r.B.mpa) ? `${Math.round(r.B.mpa)}'` : <span className="dim">—</span>}</td>
              <td>{div(r.dMin)}</td>
              <td className="tnum">{num(r.B.len) ? `${Math.round(r.B.len)}'` : <span className="dim">—</span>}</td>
              <td className={`tnum ${r.dLen >= 3 ? 'delta-dn' : r.dLen <= -3 ? 'delta-up' : ''}`}>{num(r.dLen) ? `${sg(r.dLen)}'` : <span className="dim">—</span>}</td>
              <td className="tnum">{!num(r.dExit) ? <span className="dim">—</span> : `${R(r.A.exit)}' → ${R(r.B.exit)}'`}</td>
              <td className="tnum">{R(r.totB)}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="note">Shift = {LB} minus {LA}. <span className="delta-dn">Orange</span> = more in {LB}, <span className="delta-up">blue</span> = less. Spell = average length of each stint on the field. Starter 1st exit = when she first came off in matches she started and didn&apos;t finish. Faded rows have fewer than 2 matches on one side.</p>
      </section>
      <section className="panel"><h2>Takeaways</h2>
        <ul className="insights">{tk.map((t, i) => <li key={i}><span className={`ic ${i % 2 ? 'o' : ''}`}>{i + 1}</span><span>{t}</span></li>)}</ul>
      </section>
      {condEditor}
    </>
  );
}

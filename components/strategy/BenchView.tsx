'use client';
// Bench tab. Port of renderBench (L1609–1668) + starters-vs-bench output panel.
import Link from 'next/link';
import { useBoard } from '@/lib/data/board';
import { sum } from '@/lib/engine';
import type { Game, Result } from '@/lib/types';
import { BPRESETS, benchOfGame, benchOutput, type BKey, type BenchGame, type OutputSide } from './bench';
import { Donut } from './Donut';
import { PosTag, Seg, nextSort, secOf, sortRows, useNames, vsAt, type SortState } from './common';

type ResKey = 'All' | Result;
interface BenchUi { sel: string[] | null; group: BKey; res: ResKey; sort: SortState }
const DEF: BenchUi = { sel: null, group: 'all', res: 'All', sort: { key: 'min', dir: -1 } };
const RESOPTS = [['All', 'All'], ['W', 'Wins'], ['T', 'Ties'], ['L', 'Losses']] as const;
const COLS: [string, string, 1 | -1][] = [['p', 'Player', 1], ['apps', 'Bench apps', -1], ['min', 'Bench minutes', -1], ['avg', 'Min per app', -1], ['long', 'Longest', -1], ['share', 'Share of bench min', -1], ['starts', 'Starts', -1]];
const plural = (n: number) => `${n} match${n === 1 ? '' : 'es'}`;
const sgn = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '');

export function BenchView() {
  const { games: all, loads, ui, setUi, loading } = useBoard();
  const names = useNames();
  const u: BenchUi = { ...DEF, ...((ui.bench as Partial<BenchUi>) ?? {}) };
  const save = (p: Partial<BenchUi>) => setUi('bench', { ...u, ...p });

  const preset = (k: BKey) => BPRESETS.find((p) => p[0] === k) ?? BPRESETS[0];
  const idsFor = (k: BKey, r: ResKey) => all.filter((g) => preset(k)[2](g, all) && (r === 'All' || g.result === r)).map((g) => g.id);
  const selIds = (u.sel ?? all.map((g) => g.id)).filter((id) => all.some((g) => g.id === id));
  const same = (ids: string[]) => ids.length === selIds.length && ids.every((i) => selIds.includes(i));
  const custom = !same(idsFor(u.group, u.res));
  const sel = all.filter((g) => selIds.includes(g.id));

  const D = sel.map((g) => ({ g, b: benchOfGame(g) }));
  const out = benchOutput(sel, loads);

  if (loading) return <div className="panel empty">Loading…</div>;
  if (!all.length) return <div className="panel empty">No matches yet. Add data to see bench minutes.</div>;

  const Dc = D.filter((x) => x.b.op);
  const U = { S: sum(Dc.map((x) => x.b.uf.S)), B: sum(Dc.map((x) => x.b.uf.B)), N: sum(Dc.map((x) => x.b.uf.N)) };
  const O = { S: sum(Dc.map((x) => x.b.op!.S)), B: sum(Dc.map((x) => x.b.op!.B)), N: sum(Dc.map((x) => x.b.op!.N)) };
  const diff = U.B - O.B;

  // Ranking
  const R: Record<string, { p: string; apps: number; min: number; long: number; starts: number; games: string[] }> = {};
  D.forEach(({ g, b }) => b.uf.list.forEach((p) => {
    const r = R[p.name] ?? (R[p.name] = { p: p.name, apps: 0, min: 0, long: 0, starts: 0, games: [] });
    r.apps++; r.min += p.min; r.long = Math.max(r.long, p.min); r.games.push(`${g.opp} ${p.min}'`);
  }));
  Object.values(R).forEach((r) => { r.starts = D.filter(({ g }) => (g.lineup?.starters ?? []).some((p) => p.name === r.p)).length; });
  const totB = sum(Object.values(R).map((r) => r.min)) || 1;
  const rows = sortRows(Object.values(R).map((r) => ({ ...r, avg: r.min / r.apps, share: r.min / totB })), u.sort, 'min', (r) => names.label(r.p));

  const nc = D.filter((x) => !secOf(x.g)), sc = D.filter((x) => secOf(x.g));
  const toggle = (id: string) => save({ sel: selIds.includes(id) ? selIds.filter((x) => x !== id) : [...selIds, id] });

  return (
    <div className="stack">
      <section className="panel">
        <div className="bsel-row"><span className="label" style={{ minWidth: 94 }}>Games</span>
          <Seg options={BPRESETS.map(([k, l]) => [k, l] as const)} value={custom ? null : u.group} counts={(k) => idsFor(k, u.res).length}
            onChange={(k) => save({ group: k, sel: idsFor(k, u.res) })} />
        </div>
        <div className="bsel-row" style={{ marginTop: 10 }}><span className="label" style={{ minWidth: 94 }}>Result</span>
          <Seg options={RESOPTS} value={custom ? null : u.res} counts={(r) => idsFor(u.group, r).length}
            onChange={(r) => save({ res: r, sel: idsFor(u.group, r) })} />
        </div>
        <div className="bsel-row" style={{ marginTop: 10 }}><span className="label" style={{ minWidth: 94 }}>Matches</span>
          <div className="chips">
            {all.map((g) => (
              <button key={g.id} type="button" className="mchip" aria-pressed={selIds.includes(g.id)} onClick={() => toggle(g.id)}>
                <span className={`res-${g.result}`}>{g.result}</span> {g.opp}{secOf(g) && <> <span className="pos">SEC</span></>}
              </button>
            ))}
          </div>
        </div>
        <p className="note" style={{ margin: '10px 0 0' }}>{sel.length} match{sel.length === 1 ? '' : 'es'} selected{custom ? ' (custom pick)' : ''} · group and result combine, e.g. SEC + Losses · tap a match to add or remove it.</p>
      </section>

      {!sel.length ? <div className="panel empty">Select at least one match.</div> : (
        <>
          <div className="gridW bench-grid">
            <section className="panel"><h3>Who carries the minutes · {plural(sel.length)}</h3>
              <div className="bbig">
                <div><div className="bl big">Florida</div>
                  <Donut s={U.S} b={U.B} size={230} big title={`Florida: bench ${U.B.toLocaleString()} of ${(U.S + U.B).toLocaleString()} min`} />
                  <div className="bm big">{U.B.toLocaleString()} bench min</div></div>
                <div><div className="bl big">Opponents</div>
                  {Dc.length ? <Donut s={O.S} b={O.B} size={230} big title={`Opponents: bench ${O.B.toLocaleString()} of ${(O.S + O.B).toLocaleString()} min`} /> : <div className="empty">No opponent box scores</div>}
                  <div className="bm big">{Dc.length ? O.B.toLocaleString() + ' bench min' : ''}</div></div>
              </div>
              {Dc.length > 0 && (
                <div className="bcall">
                  <div><span className="bnum" style={{ color: diff >= 0 ? 'var(--bench-be)' : 'var(--loss)' }}>{diff >= 0 ? '+' : '−'}{Math.abs(diff)}</span>
                    <div><b>{diff >= 0 ? 'more' : 'fewer'} bench minutes</b><br /><span className="muted">than our opponents, ~{Math.round(Math.abs(diff) / Dc.length)} {diff >= 0 ? 'extra' : 'fewer'} per match</span></div></div>
                  <div><span className="bnum" style={{ color: 'var(--bench-st)' }}>{(U.B / (U.N || 1)).toFixed(1)}</span>
                    <div><b>min per bench player</b><br /><span className="muted">vs {(O.B / (O.N || 1)).toFixed(1)} for opponents ({U.N} vs {O.N} subs used)</span></div></div>
                </div>
              )}
              <div className="legend"><span><i className="sw" style={{ background: 'var(--bench-st)' }} />Starters&apos; minutes</span><span><i className="sw" style={{ background: 'var(--bench-be)' }} />Bench minutes</span></div>
            </section>
            <section className="panel"><h3>Match by match</h3>
              {nc.length > 0 && <><SecHead lab="Non-conference" list={nc} /><div className="bpairs">{nc.map((x) => <Pair key={x.g.id} {...x} />)}</div></>}
              {sc.length > 0 && <><SecHead lab="SEC" list={sc} /><div className="bpairs">{sc.map((x) => <Pair key={x.g.id} {...x} />)}</div></>}
            </section>
          </div>

          <OutputPanel S={out.S} B={out.B} n={sel.length} />

          <section className="panel"><h3>Bench minutes ranking · Florida · {plural(sel.length)}</h3>
            <div className="tablewrap"><table><thead><tr>
              {COLS.map(([k, l, def]) => (
                <th key={k} className="sortable" style={k === 'p' ? { textAlign: 'left' } : undefined} onClick={() => save({ sort: nextSort(u.sort, k, def) })}>
                  {l} {u.sort.key === k && <span className="dir">{u.sort.dir === -1 ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr></thead><tbody>
              {rows.map((r, i) => (
                <tr key={r.p} title={`${names.label(r.p)} off the bench\n${r.games.join('\n')}`}>
                  <td><span className="dim tnum" style={{ display: 'inline-block', width: 22 }}>{i + 1}</span><span className="pname">{names.label(r.p)}</span><PosTag pos={names.pos(r.p)} /></td>
                  <td className="tnum">{r.apps}</td>
                  <td className="tnum big" style={{ color: 'var(--bench-be)' }}>{r.min}</td>
                  <td className="tnum">{r.avg.toFixed(1)}</td>
                  <td className="tnum">{r.long}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <div style={{ width: 90, height: 8, borderRadius: 4, background: 'var(--track)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(r.share * 100).toFixed(1)}%`, background: 'var(--bench-be)' }} /></div>
                    <span className="tnum">{(r.share * 100).toFixed(1)}%</span></div></td>
                  <td className="tnum">{r.starts || <span className="dim">0</span>}</td>
                </tr>
              ))}
              <tr><td><b>Total</b></td><td className="tnum"><b>{sum(rows.map((r) => r.apps))}</b></td><td className="tnum"><b>{sum(rows.map((r) => r.min))}</b></td><td /><td /><td /><td /></tr>
            </tbody></table></div>
            <p className="note">Bench = players who did not start that match; a starter who comes back on later still counts as a starter. &quot;Starts&quot; = matches she started within this selection. Minutes come from each team&apos;s official box score (the same source for both teams), so they can differ from the sub-timestamp minutes elsewhere by a minute or two. Hover a row for her minutes in each match.</p>
          </section>
        </>
      )}
    </div>
  );
}

function SecHead({ lab, list }: { lab: string; list: { b: BenchGame }[] }) {
  const l = list.filter((x) => x.b.op);
  const b = sum(l.map((x) => x.b.uf.B)), o = sum(l.map((x) => x.b.op!.B));
  return (
    <div className="bsec-h"><span>{lab}</span>
      {l.length > 0 && <b className={b > o ? 'up' : b < o ? 'dn' : ''}>Florida {b} vs {o} bench min ({sgn(b - o)}{Math.abs(b - o)})</b>}
    </div>
  );
}

function Pair({ g, b }: { g: Game; b: BenchGame }) {
  const u = b.uf, o = b.op, d = o ? u.B - o.B : null;
  return (
    <div className="bpair">
      <div className="bpair-h"><Link className="linkbtn" href={`/games?id=${encodeURIComponent(g.id)}`}>{vsAt(g)} {g.opp}</Link> <span className={`res-${g.result}`}>{g.result} {g.gf}–{g.ga}</span></div>
      <div className="bpair-d">
        <div><div className="bl">Florida</div><Donut s={u.S} b={u.B} size={104} title={`Florida vs ${g.opp}: bench ${u.B} of ${u.S + u.B} min · ${u.N} bench players`} /><div className="bm">{u.B} min</div></div>
        <div><div className="bl">{g.opp}</div>
          {o ? <Donut s={o.S} b={o.B} size={104} title={`${g.opp}: bench ${o.B} of ${o.S + o.B} min · ${o.N} bench players`} /> : <div className="empty" style={{ padding: '30px 0' }}>No box score</div>}
          <div className="bm">{o ? o.B + ' min' : ''}</div></div>
      </div>
      {o && d != null && <>
        <div className={`bdiff ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}`}>{sgn(d)}{Math.abs(d)} bench min</div>
        <div className="bsub">{(u.B / (u.N || 1)).toFixed(1)} vs {(o.B / (o.N || 1)).toFixed(1)} min/sub ({u.N} v {o.N})</div>
      </>}
    </div>
  );
}

/** Starters vs bench output side by side: shots, goals, and GPS running output per minute. */
function OutputPanel({ S, B, n }: { S: OutputSide; B: OutputSide; n: number }) {
  const per90 = (x: number, m: number) => (m > 0 ? ((x / m) * 90).toFixed(2) : '—');
  const perMin = (x: number, m: number, dp = 1) => (m > 0 ? (x / m).toFixed(dp) : '—');
  const gps = S.gpsApps > 0 || B.gpsApps > 0;
  const rows: [string, string, string, string?][] = [
    ['Appearances', String(S.apps), String(B.apps)],
    ['Minutes', S.min.toLocaleString(), B.min.toLocaleString()],
    ['Shots', String(S.sh), String(B.sh)],
    ['Shots per 90', per90(S.sh, S.min), per90(B.sh, B.min)],
    ['Goals', String(S.g), String(B.g)],
    ['Goals per 90', per90(S.g, S.min), per90(B.g, B.min)],
  ];
  if (gps) rows.push(
    ['Distance per min', perMin(S.dist, S.gpsMin), perMin(B.dist, B.gpsMin), 'GPS'],
    ['HSR per min', perMin(S.hsr, S.gpsMin), perMin(B.hsr, B.gpsMin), 'GPS'],
    ['Sprint per min', perMin(S.sprint, S.gpsMin, 2), perMin(B.sprint, B.gpsMin, 2), 'GPS'],
    ['Accels + decels per min', perMin(S.acc, S.gpsMin, 2), perMin(B.acc, B.gpsMin, 2), 'GPS'],
  );
  return (
    <section className="panel"><h3>Starters vs bench output · Florida · {plural(n)}</h3>
      <div className="tablewrap"><table className="cmp"><thead><tr><th style={{ textAlign: 'left' }}>Measure</th><th style={{ color: 'var(--bench-st)' }}>Starters</th><th style={{ color: 'var(--bench-be)' }}>Bench</th></tr></thead><tbody>
        {rows.map(([l, s, b, tag]) => {
          const x = parseFloat(s.replace(/,/g, '')), y = parseFloat(b.replace(/,/g, ''));
          const rate = l.includes('per');
          return (
            <tr key={l}><td style={{ textAlign: 'left' }}>{l}{tag && <> <span className="pos">{tag}</span></>}</td>
              <td className={`tnum${rate && x > y ? ' up' : ''}`}>{s}</td><td className={`tnum${rate && y > x ? ' dn' : ''}`}>{b}</td></tr>
          );
        })}
      </tbody></table></div>
      <p className="note">Shots include goals; from the box score where present, otherwise the play-by-play. Per 90 = per 90 minutes played. {gps ? `GPS rates use only appearances with loads uploaded (${S.gpsApps} starter, ${B.gpsApps} bench), divided by that player's box-score minutes.` : 'Upload GPS loads to compare running output per minute.'}</p>
    </section>
  );
}

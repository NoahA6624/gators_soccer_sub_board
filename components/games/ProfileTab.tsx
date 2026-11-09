'use client';
// Player Profile tab. Port of renderPP (gator-sub-board.html L2075–2156), ppTrend/ppBins (L2042–2074),
// ppRestSection (L2192–2201). Engine: ppRec(games,p) -> per-game records, ppAgg, ppWeek(games,p), restsOf(games,p), restAgg.
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBoard } from '@/lib/data/board';
import { avg, buildNameIndex, clk, fullD, isSEC, playerLabel, posOf, ppAgg, ppRec, ppWeek, restAgg, restsOf, sum, type Agg } from '@/lib/engine';
import type { Game } from '@/lib/types';
import { grpFn, isPost, PPBINS, ppD, ppG, ppGames, PPGRP, spellText, wkInfo } from './helpers';
import { ppInsights } from './ppInsights';

interface PPUi { player?: string | null; grp?: string; res?: string }
type Rec = Agg;

const M = ({ v }: { v: number | null | undefined }) => (v == null || isNaN(v) ? <>—</> : <>{Math.round(v)}<small>&apos;</small></>);
const signed = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(Math.round(d));

function Kpi({ v, k, sub }: { v: React.ReactNode; k: string; sub?: React.ReactNode }) {
  return (
    <div className="kpi"><div className="v">{v}</div><div className="k">{k}</div>
      {sub ? <div className="k dim" style={{ fontSize: 11.5 }}>{sub}</div> : null}</div>
  );
}

const recsFor = (games: Game[], p: string): Rec[] => (p ? (ppRec(games, p) ?? []) : []);
const gm = (r: Rec | undefined) => (r?.g ? `${ppD(r.g)} ${ppG(r.g)}` : '');

function PPTrend({ recs, A }: { recs: Rec[]; A: Agg }) {
  const W = 760, H = 280, l = 38, r = 14, t = 30, b = 58, n = recs.length;
  if (!n) return null;
  const top = Math.max(90, ...recs.map((x) => x.min || 0));
  const y = (v: number) => t + (H - t - b) * (1 - v / top);
  const x = (i: number) => (n === 1 ? (l + W - r) / 2 : l + (W - l - r) * (i / (n - 1)));
  const roll = n >= 3 ? recs.map((_, i) => (i < 2 ? null : avg(recs.slice(i - 2, i + 1).map((q) => q.min || 0)))) : [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Minutes per match">
      {[0, 15, 30, 45, 60, 75, 90].map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 45 ? '3 3' : undefined} />
          <text x={l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">{v}</text>
        </g>
      ))}
      {A.apps && A.avg != null ? (
        <>
          <line x1={l} x2={W - r} y1={y(A.avg)} y2={y(A.avg)} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x={W - r} y={y(A.avg) - 5} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--muted)">avg {Math.round(A.avg)}&apos;</text>
        </>
      ) : null}
      {roll.length ? <path d={roll.map((v, i) => (v == null ? '' : `${roll[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join('')} fill="none" stroke="var(--opp)" strokeWidth="2" /> : null}
      <path d={recs.map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(q.min || 0).toFixed(1)}`).join('')} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      {recs.map((q, i) => {
        const cx = x(i), cy = y(q.min || 0); const g = q.g as Game;
        const tipT = `${ppD(g)} ${ppG(g)} · ${g.result} ${g.gf}–${g.ga}\n` + (q.played
          ? `${q.start ? 'Started' : 'Off the bench'} · ${Math.round(q.min)}'\n1st half ${Math.round(q.h1 || 0)}' · 2nd half ${Math.round(q.h2 || 0)}'\nOn the field: ${spellText(q.sp)}`
          : q.listed ? 'Did not play (on the bench)' : 'Not on the box score');
        return (
          <g key={g.id}>
            <rect x={cx - 12} y={t} width="24" height={H - t - b} fill="transparent"><title>{tipT}</title></rect>
            {q.played
              ? <circle cx={cx} cy={cy} r="6" fill={q.start ? 'var(--bench-st)' : 'var(--bench-be)'} stroke="var(--surface)" strokeWidth="2" style={{ pointerEvents: 'none' }} />
              : <circle cx={cx} cy={cy} r="5" fill="var(--surface)" stroke="var(--faint)" strokeWidth="2" style={{ pointerEvents: 'none' }} />}
            {q.played && (q === A.max || n <= 14) && <text x={cx} y={cy - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)" style={{ pointerEvents: 'none' }}>{Math.round(q.min)}</text>}
            <text x={cx} y={H - b + 16} textAnchor="middle" fontSize="10.5" fill="var(--muted)" style={{ pointerEvents: 'none' }}>{ppD(g)}</text>
            <text x={cx} y={H - b + 30} textAnchor="middle" fontSize="10.5" fill="var(--faint)" style={{ pointerEvents: 'none' }}>{g.opp.length > 9 ? g.opp.slice(0, 8) + '…' : g.opp}</text>
            {isSEC(g) && <text x={cx} y={H - b + 43} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--faint)" style={{ pointerEvents: 'none' }}>SEC</text>}
          </g>
        );
      })}
    </svg>
  );
}

function PPBins({ A }: { A: Agg }) {
  const bins: number[] = Array.isArray(A.bins) ? A.bins : PPBINS.map(() => 0);
  const binOn: number[] = Array.isArray(A.binOn) ? A.binOn : PPBINS.map(() => 0);
  const mx = Math.max(...bins, 0.01);
  const topI = new Set(bins.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).filter((o) => o[0] > 0).map((o) => o[1]));
  return (
    <>
      <div className="ppbins">
        {PPBINS.map(([a, b2], i) => (
          <div className="ppbin" key={a} title={`${a}'–${b2}'\nOn the field ${Math.round((bins[i] || 0) * 100)}% of this window, on average\nOn at some point in ${binOn[i] ?? 0} of ${A.apps} matches`}>
            <div className="ppbar"><i style={{ height: `${((bins[i] || 0) / mx * 100).toFixed(1)}%`, background: topI.has(i) ? 'var(--blue)' : 'var(--bench-st)', opacity: topI.has(i) ? 1 : 0.55 }} /></div>
            <b className="tnum">{Math.round((bins[i] || 0) * 100)}%</b><span>{a}–{b2}&apos;</span>{topI.has(i) && <em>Top</em>}
          </div>
        ))}
      </div>
      <p className="note" style={{ margin: '8px 0 0' }}>Share of each 15-minute window she spends on the field, across the matches she played. HT sits between 30–45&apos; and 45–60&apos;. Overtime isn&apos;t included.</p>
    </>
  );
}

function WkCard({ cls, lab, a, extra }: { cls: string; lab: string; a: Agg | undefined; extra?: React.ReactNode }) {
  const x = a ?? {};
  const mt = (r: Rec | undefined, nTie?: number) => (r ? <>{Math.round(r.min)}&apos; <span className="wk-g">{gm(r)}{(nTie ?? 0) > 1 ? ` (+${(nTie ?? 0) - 1} more)` : ''}</span></> : '—');
  const same = x.apps > 1 && x.max && x.min && Math.round(x.max.min) === Math.round(x.min.min);
  return (
    <div className={`wk ${cls}`}>
      <div className="wk-l">{lab}</div>
      <div className="wk-v"><M v={x.avg} /></div>
      <div className="wk-s">avg per match played · {x.apps ?? 0} of {x.n ?? 0} played · {x.starts ?? 0} starts</div>
      <div className="wk-rows">
        {same
          ? <div><span>Max / Min</span><b>{Math.round(x.max.min)}&apos; <span className="wk-g">in all {x.apps} matches</span></b></div>
          : <><div><span>Max</span><b>{x.apps ? mt(x.max, x.maxN) : '—'}</b></div><div><span>Min</span><b>{x.apps ? mt(x.min, x.minN) : '—'}</b></div></>}
        {extra}
      </div>
    </div>
  );
}

function WeekSection({ w, label }: { w: Agg; label: string }) {
  const one = w.one ?? {}, two = w.two ?? {}, home = w.home ?? {}, away = w.away ?? {};
  const d = one.avg != null && two.avg != null ? two.avg - one.avg : null;
  const P: Agg[] = Array.isArray(w.pairs) ? w.pairs : [];
  const up = P.filter((x) => x.d >= 3).length, dn = P.filter((x) => x.d <= -3).length, eq = P.length - up - dn;
  const md = P.length ? avg(P.map((x) => x.d)) ?? 0 : null;
  const wks = (n: number) => `${n} of ${P.length} week${P.length === 1 ? '' : 's'}`;
  const big = md != null && Math.abs(md) >= 10;
  const steady = 'The gap is small, so her minutes hold fairly steady across the week.';
  const verdict = !P.length ? <>No complete two-match weeks in this selection.</>
    : up > dn ? <><b>Match 2 is usually higher</b>: more minutes in Match 2 in {wks(up)} (avg {md! >= 0 ? '+' : '−'}{Math.abs(Math.round(md!))}&apos;). {big ? 'She tends to be managed in Match 1 and leaned on in Match 2.' : steady}</>
    : dn > up ? <><b>Match 1 is usually higher</b>: more minutes in Match 1 in {wks(dn)} (avg {Math.abs(Math.round(md!))}&apos; fewer in Match 2). {big ? 'Her minutes drop in the second match of the week.' : steady}</>
    : <><b>No consistent pattern</b>: Match 2 higher in {up}, Match 1 higher in {dn}, about level (within 3&apos;) in {wks(eq)}.</>;
  const bar = (v: number, c: string) => <div className="pbar"><i style={{ width: `${Math.min(100, (v || 0) / 90 * 100).toFixed(1)}%`, background: c }} /></div>;
  const cellP = (r: Rec) => (r?.played ? `${Math.round(r.min)}'` : <span className="dim">DNP</span>);
  const dv = home.avg != null && away.avg != null ? away.avg - home.avg : null;
  return (
    <section className="panel">
      <h2>Single vs two-match weeks · Home vs away</h2>
      <p className="note" style={{ margin: '-4px 0 12px' }}>{label} · weeks run Monday–Sunday · a two-match week has 2 matches in the same week (usually Thu + Sun)</p>
      <div className="wkgrid">
        <WkCard cls="wk1" lab="Single-match week" a={one} />
        <WkCard cls="wk2" lab="Two-match week" a={two} extra={<><div><span>Match 1 avg</span><b><M v={w.g1?.avg} /></b></div><div><span>Match 2 avg</span><b><M v={w.g2?.avg} /></b></div></>} />
        <div className="wk wkd"><div className="wk-l">Difference</div><div className="wk-v">{d == null ? '—' : <>{signed(d)}<small>&apos;</small></>}</div>
          <div className="wk-s">{d == null ? 'Needs matches of both types' : Math.abs(d) < 3 ? 'About the same per match either way' : d > 0 ? 'More minutes per match in two-match weeks' : 'Fewer minutes per match in two-match weeks'}</div></div>
      </div>
      <h3 style={{ marginTop: 18 }}>Match 1 vs Match 2 in two-match weeks</h3>
      <p style={{ margin: '0 0 10px' }}>{verdict}{P.length > 0 && P.length < 3 && <> <span className="warn">Only {P.length} two-match week{P.length === 1 ? '' : 's'} in this selection, so treat it as a lead, not a pattern.</span></>}</p>
      {P.length > 0 && (
        <>
          <div className="tablewrap"><table><thead><tr><th>Week</th><th style={{ textAlign: 'left' }}>Match 1</th><th></th><th>Mins</th><th style={{ textAlign: 'left' }}>Match 2</th><th></th><th>Mins</th><th>M2 − M1</th><th>Higher</th></tr></thead><tbody>
            {P.map((x, i) => (
              <tr key={i}>
                <td className="tnum">{x.m1?.g ? ppD(x.m1.g) : ''}–{x.m2?.g ? ppD(x.m2.g) : ''}</td>
                <td style={{ textAlign: 'left' }}>{x.m1?.g ? ppG(x.m1.g) : ''}</td><td>{bar(x.m1?.min, 'color-mix(in srgb, var(--orange) 50%, var(--surface))')}</td><td className="tnum big">{cellP(x.m1)}</td>
                <td style={{ textAlign: 'left' }}>{x.m2?.g ? ppG(x.m2.g) : ''}</td><td>{bar(x.m2?.min, 'var(--orange)')}</td><td className="tnum big">{cellP(x.m2)}</td>
                <td className={`tnum ${x.d >= 3 ? 'delta-up' : x.d <= -3 ? 'delta-dn' : ''}`}>{signed(x.d)}&apos;</td><td>{x.d >= 3 ? 'Match 2' : x.d <= -3 ? 'Match 1' : 'Level'}</td>
              </tr>
            ))}
            <tr><td></td><td style={{ textAlign: 'left' }}><b>Average</b></td><td></td><td className="tnum"><b>{Math.round(avg(P.map((x) => x.m1?.min || 0)) ?? 0)}&apos;</b></td><td></td><td></td>
              <td className="tnum"><b>{Math.round(avg(P.map((x) => x.m2?.min || 0)) ?? 0)}&apos;</b></td><td className="tnum"><b>{signed(md ?? 0)}&apos;</b></td><td><b>{up}–{dn}–{eq}</b></td></tr>
          </tbody></table></div>
          <p className="note" style={{ marginTop: 6 }}>A match she didn&apos;t play counts as 0 in the week comparison. &quot;Higher&quot; needs a gap of 3+ minutes; record shown as Match 2 higher – Match 1 higher – level.</p>
        </>
      )}
      <h3 style={{ marginTop: 18 }}>Home vs away</h3>
      <div className="wkgrid">
        <WkCard cls="wkh" lab="Home" a={home} />
        <WkCard cls="wka" lab="Away" a={away} />
        <div className="wk wkd"><div className="wk-l">Difference</div><div className="wk-v">{dv == null ? '—' : <>{signed(dv)}<small>&apos;</small></>}</div>
          <div className="wk-s">{dv == null ? 'Needs home and away matches' : Math.abs(dv) < 3 ? 'About the same home or away' : dv > 0 ? 'More minutes per match away' : 'Fewer minutes per match away'}</div></div>
      </div>
    </section>
  );
}

function RestSection({ rests, label }: { rests: Agg[]; label: string }) {
  const rs = rests.filter((r) => r && typeof r.len === 'number');
  const a = restAgg(rs.filter((x) => (x.kind ?? 'in2') === 'in2') as never) ?? {};
  const rDesc = (r: Agg | undefined) => (r ? <>{Math.round(r.len)}&apos; <span className="wk-g">{gm(r)} · off {clk(r.off)}, back {clk(r.on)}</span></> : '—');
  const list = rs.slice().sort((x, y) => (y.g?.date ?? '').localeCompare(x.g?.date ?? '') || x.off - y.off);
  return (
    <section className="panel">
      <h2>Rest between spells · 2nd half</h2>
      <p className="note" style={{ margin: '-4px 0 12px' }}>{label} · a rest is the match time between coming off and going back on, both in the 2nd half. Subbed off at halftime counts, starting at 45:00.</p>
      <div className="wkgrid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <div className="wk wk2"><div className="wk-l">Rests within the 2nd half</div><div className="wk-v"><M v={a.n ? a.avg : null} /></div>
          <div className="wk-s">avg rest · {a.n ?? 0} rest{a.n === 1 ? '' : 's'}{a.n ? ` in ${a.matches} match${a.matches === 1 ? '' : 'es'}` : ''}</div>
          {a.n ? <div className="wk-rows"><div><span>Longest</span><b>{rDesc(a.max)}</b></div><div><span>Shortest</span><b>{rDesc(a.min)}</b></div>
            <div><span>Back for</span><b>{Math.round(a.back ?? 0)}&apos; <span className="wk-g">avg after returning</span></b></div></div> : null}
        </div>
      </div>
      {list.length ? (
        <div className="tablewrap" style={{ marginTop: 12 }}><table><thead><tr><th>Date</th><th style={{ textAlign: 'left' }}>Match</th><th>Off</th><th>Back on</th><th>Rest</th><th>Back for</th></tr></thead><tbody>
          {list.map((r, i) => (
            <tr key={i}><td className="tnum">{r.g ? ppD(r.g) : ''}</td><td style={{ textAlign: 'left' }}>{r.g ? ppG(r.g) : ''}</td><td className="tnum">{clk(r.off)}</td><td className="tnum">{clk(r.on)}</td>
              <td className="tnum big" style={{ color: (r.kind ?? 'in2') === 'in2' ? 'var(--orange)' : 'var(--muted)' }}>{Math.round(r.len)}&apos;</td><td className="tnum">{Math.round(r.back ?? 0)}&apos;</td></tr>
          ))}
        </tbody></table></div>
      ) : <p className="note">She hasn&apos;t come off and gone back on in the 2nd half in this selection.</p>}
    </section>
  );
}

export function ProfileTab() {
  const { games: rawGames, roster, ui, setUi, loading } = useBoard();
  const games = useMemo(() => [...rawGames].sort((a, b) => a.date.localeCompare(b.date)), [rawGames]);
  const idx = useMemo(() => buildNameIndex(games, roster), [games, roster]);
  const sp = useSearchParams();
  const qp = sp.get('player');
  const st = (ui.pp as PPUi) || {};
  const f = { player: st.player ?? null, grp: st.grp ?? 'all', res: st.res ?? 'All' };
  const set = (patch: Partial<PPUi>) => setUi('pp', { ...f, ...patch });

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    games.forEach((g) => Object.entries(fullD(g)?.mins ?? {}).forEach(([p, m]) => (t[p] = (t[p] || 0) + m)));
    return t;
  }, [games]);
  const names = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);

  // Deep link from Players tab: /profile?player=<last>
  useEffect(() => {
    if (qp && qp !== st.player) setUi('pp', { ...f, player: qp });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp]);

  const p = f.player && (totals[f.player] != null || f.player === qp) ? f.player : names[0] ?? '';
  const L = (q: string) => playerLabel(q, idx);

  if (loading) return <div className="panel empty">Loading…</div>;
  if (!games.length) return <div className="panel empty">No matches yet. Add a match in Add data.</div>;

  const gs = ppGames(games, f.grp, f.res);
  const recs = recsFor(gs, p);
  const A: Agg = ppAgg(recs as never) ?? {};
  const fixed = ([['Season', 'all'], ['Non-conference', 'nc'], ['SEC', 'sec'], ['Postseason', 'post']] as const).map(([l, k]) => {
    const sub = games.filter(grpFn(k));
    return { l, k, a: (ppAgg(recsFor(sub, p) as never) ?? {}) as Agg, n: sub.length };
  });
  const selTot: Record<string, number> = {};
  gs.forEach((g) => Object.entries(fullD(g)?.mins ?? {}).forEach(([q, m]) => (selTot[q] = (selTot[q] || 0) + m)));
  const isGK = (q: string) => posOf(q, games, roster) === 'GK';
  const ord = Object.keys(selTot).sort((a, b) => selTot[b] - selTot[a]);
  const rank = ord.indexOf(p) + 1, nRank = ord.length;
  const grpOrd = ord.filter((q) => isGK(q) === isGK(p)); const gRank = grpOrd.indexOf(p) + 1;
  const gLab = isGK(p) ? 'goalkeepers' : 'field players';
  const pos = p ? posOf(p, games, roster) : '';
  const grpOpts = PPGRP.map(([k, l, fn]) => [k, `${l} (${fn ? games.filter(fn).length : Math.min(games.length, k === 'last3' ? 3 : 5)})`]);
  const single = f.grp.startsWith('g:') ? games.find((x) => x.id === f.grp.slice(2)) : undefined;
  const label = `${f.grp.startsWith('g:') ? (single ? `${ppD(single)} ${ppG(single)}` : '') : (PPGRP.find((x) => x[0] === f.grp) ?? PPGRP[0])[1]}${f.res !== 'All' ? ' · ' + ({ W: 'Wins', T: 'Ties', L: 'Losses' } as Record<string, string>)[f.res] : ''}`;
  const played = recs.filter((r) => r?.played);
  const ins = gs.length && p ? ppInsights(p, recs, games) : null;
  const week: Agg = (p ? ppWeek(gs, p) : null) ?? {};
  const rests: Agg[] = p ? (restsOf(played.map((r) => r.g as Game), p) ?? []) : [];
  const W = wkInfo(games);
  const s0 = fixed[0].a;

  return (
    <div className="stack">
      <section className="panel">
        <div className="filters" style={{ margin: 0 }}>
          <div className="field"><span className="label">Player</span>
            <select value={p} onChange={(e) => set({ player: e.target.value })}>
              {!names.includes(p) && p && <option value={p}>{L(p)}</option>}
              {names.map((n) => <option key={n} value={n}>{L(n)} · {Math.round(totals[n])}&apos;</option>)}
            </select></div>
          <div className="field"><span className="label">Matches</span>
            <select value={f.grp} onChange={(e) => set({ grp: e.target.value })}>
              <optgroup label="Match groups">{grpOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>
              <optgroup label="Single match">{games.slice().reverse().map((g) => <option key={g.id} value={`g:${g.id}`}>{ppD(g)} {ppG(g)} ({g.result} {g.gf}–{g.ga})</option>)}</optgroup>
            </select></div>
          <div className="field"><span className="label">Result</span>
            <select value={f.res} onChange={(e) => set({ res: e.target.value })}>
              {[['All', 'All results'], ['W', 'Wins'], ['T', 'Ties'], ['L', 'Losses']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
        </div>
      </section>

      {!p ? <section className="panel empty">No players with minutes yet.</section> : (
        <>
          <section className="panel">
            <div className="profile-head"><div>
              <div className="nm">{L(p)}{pos && <> <span className="pos" style={{ fontSize: 13, verticalAlign: 4 }}>{pos}</span></>}</div>
              <div className="muted" style={{ marginTop: 4 }}>{games.length} matches this season · {s0.apps || 0} played · {s0.starts || 0} starts · {Math.round(s0.tot || 0)} total minutes</div>
            </div></div>
            <h3>Average minutes per match played</h3>
            <div className="kpis4">
              {fixed.map((x) => <Kpi key={x.k} v={x.a.apps ? <M v={x.a.avg} /> : '—'} k={x.l} sub={x.n ? `${x.a.apps || 0} of ${x.n} matches played` : x.k === 'post' ? 'No postseason matches yet' : 'No matches'} />)}
            </div>
          </section>

          {gs.length > 0 && (
            <section className="panel">
              <h2>Analysis</h2>
              {ins ? (
                <>
                  <p className="note" style={{ margin: '-4px 0 12px' }}>{L(p)} · {label} · written from the matches in this selection; changes with the filters above.</p>
                  <ul className="insights">{ins.map(([h, t], i) => <li key={h}><span className={`ic ${i % 2 ? 'o' : ''}`}>{i + 1}</span><span><b>{h}.</b> <span dangerouslySetInnerHTML={{ __html: t }} /></span></li>)}</ul>
                </>
              ) : <p className="note">She hasn&apos;t played in this selection.</p>}
            </section>
          )}

          {gs.length ? (
            <>
              <section className="panel">
                <h3>Selection · {label} · {gs.length} match{gs.length === 1 ? '' : 'es'}</h3>
                <div className="kpis">
                  <Kpi v={<M v={A.tot || 0} />} k="Total minutes" sub={A.apps ? <><b>#{gRank} of {grpOrd.length} {gLab}</b><br />#{rank} of {nRank} overall</> : ''} />
                  <Kpi v={A.apps ? <M v={A.avg} /> : '—'} k="Avg per match played" sub={`${A.apps ?? 0} of ${A.n ?? recs.length} played · ${A.starts ?? 0} starts`} />
                  <Kpi v={A.apps && A.max ? <M v={A.max.min} /> : '—'} k="Max minutes" sub={A.apps && A.max ? (() => {
                    const ties = played.filter((r) => Math.round(r.min) === Math.round(A.max.min)); const last = ties[ties.length - 1];
                    return ties.length > 1 ? `${ties.length} matches · latest ${gm(last)}` : gm(A.max);
                  })() : ''} />
                  <Kpi v={A.apps && A.min ? <M v={A.min.min} /> : '—'} k="Fewest (when played)" sub={A.apps ? gm(A.min) : ''} />
                  <Kpi v={A.apps ? <>{Math.round(A.h1 ?? 0)}<small>&apos; / </small>{Math.round(A.h2 ?? 0)}<small>&apos;</small></> : '—'} k="Avg 1st / 2nd half" sub={A.apps && A.spells != null ? `${Number(A.spells).toFixed(1)} spells per match` : ''} />
                  <Kpi v={A.apps ? A.full ?? 0 : '—'} k="Full 90s" sub={A.apps ? `of ${A.apps} played` : ''} />
                </div>
              </section>

              <WeekSection w={week} label={label} />
              <RestSection rests={rests} label={label} />

              <section className="panel"><h3>Minutes by match · {label}</h3>
                <div className="chart"><PPTrend recs={recs} A={A} /></div>
                <div className="legend">
                  <span><i className="sw" style={{ background: 'var(--bench-st)' }} />Started</span>
                  <span><i className="sw" style={{ background: 'var(--bench-be)' }} />Off the bench</span>
                  <span><i className="sw" style={{ background: 'var(--surface)', border: '2px solid var(--faint)', width: 8, height: 8 }} />Did not play</span>
                  <span><i style={{ display: 'inline-block', width: 16, borderTop: '2px solid var(--opp)' }} />3-match rolling avg</span>
                  <span><i style={{ display: 'inline-block', width: 16, borderTop: '2px dashed var(--muted)' }} />Selection avg</span>
                </div>
              </section>

              {A.apps ? (
                <div className="grid2">
                  <section className="panel"><h3>Most frequent 15-minute windows</h3><PPBins A={A} /></section>
                  <section className="panel"><h3>Where her minutes come from</h3>
                    {(() => {
                      const parts = ([['Non-conf', 'nc'], ['SEC', 'sec'], ['Postseason', 'post']] as const)
                        .map(([l, k]) => [l, sum(played.filter((r) => grpFn(k)(r.g)).map((r) => r.min))] as const).filter((x) => x[1] > 0);
                      const tot = sum(parts.map((x) => x[1])) || 1;
                      const stM = sum(played.filter((r) => r.start).map((r) => r.min)), beM = sum(played.filter((r) => !r.start).map((r) => r.min));
                      const sbar = (l: string, m: number, of: number, c: string) => (
                        <div className="sbar" key={l}><span>{l}</span><div className="trk"><i style={{ width: `${(m / of * 100).toFixed(1)}%`, background: c }} /></div><b className="tnum">{Math.round(m)}&apos;</b></div>
                      );
                      return (
                        <>
                          <div className="label" style={{ marginBottom: 2 }}>By match type</div>
                          {parts.map(([l, m]) => sbar(l, m, tot, 'var(--bench-st)'))}
                          <div className="label" style={{ margin: '12px 0 2px' }}>By role</div>
                          {sbar('Started', stM, A.tot || 1, 'var(--bench-st)')}
                          {sbar('Off bench', beM, A.tot || 1, 'var(--bench-be)')}
                          <p className="note" style={{ marginTop: 8 }}>Total minutes in this selection, split by match type and by role.</p>
                        </>
                      );
                    })()}
                  </section>
                </div>
              ) : null}

              <section className="panel"><h3>Match log</h3>
                <div className="tablewrap"><table><thead><tr><th>Date</th><th style={{ textAlign: 'left' }}>Match</th><th>Result</th><th>Role</th><th>1st half</th><th>2nd half</th><th>Total</th><th style={{ textAlign: 'left' }}>On the field</th></tr></thead><tbody>
                  {recs.slice().reverse().map((q, i) => {
                    const g = q.g as Game; if (!g) return null; const w = W[g.id];
                    return (
                      <tr key={g.id ?? i}>
                        <td className="tnum">{ppD(g)}</td>
                        <td style={{ textAlign: 'left' }}>{ppG(g)}{isSEC(g) && <> <span className="pos">SEC</span></>}{isPost(g) && <> <span className="pos">POST</span></>}{w && w.n >= 2 && <> <span className="wktag">2-match wk · M{w.i}</span></>}</td>
                        <td><span className={`res-${g.result}`}>{g.result} {g.gf}–{g.ga}</span></td>
                        <td>{q.played ? (q.start ? 'Start' : 'Sub') : <span className="dim">{q.listed ? 'DNP' : '—'}</span>}</td>
                        <td className="tnum">{q.played ? Math.round(q.h1 || 0) : ''}</td>
                        <td className="tnum">{q.played ? Math.round(q.h2 || 0) : ''}</td>
                        <td className="tnum big" style={{ color: 'var(--blue)' }}>{q.played ? Math.round(q.min) : <span className="dim">0</span>}</td>
                        <td className="tnum muted" style={{ textAlign: 'left', fontSize: 13 }}>{q.played ? spellText(q.sp) : ''}</td>
                      </tr>
                    );
                  })}
                  <tr><td></td><td style={{ textAlign: 'left' }}><b>Total</b></td><td></td><td>{A.starts || 0}/{A.apps || 0}</td>
                    <td className="tnum"><b>{Math.round(sum(played.map((r) => r.h1 || 0)))}</b></td><td className="tnum"><b>{Math.round(sum(played.map((r) => r.h2 || 0)))}</b></td>
                    <td className="tnum"><b>{Math.round(A.tot || 0)}</b></td><td></td></tr>
                </tbody></table></div>
                {!recs.length && <div className="empty">No match records for this player yet.</div>}
                <p className="note">Minutes rebuilt from the official play-by-play (stoppage time not added), so totals can differ from the box score by about a minute. Averages are per match played. Postseason matches are marked in Add data.</p>
              </section>
            </>
          ) : (
            <section className="panel empty">No matches in this selection{f.grp === 'post' ? ' yet. Mark a match as postseason in Add data.' : '.'}</section>
          )}
        </>
      )}
    </div>
  );
}

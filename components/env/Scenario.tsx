'use client';
// Match scenario builder (renderScn L2301, bindScn L2331, scnPdf L2337) and
// impact check (renderChk L2227). Engine: scnCompute / chkRun via ./envEngine.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { avg } from '@/lib/engine';
import { downloadBlob, scnPdf } from '@/lib/export';
import type { Game } from '@/lib/types';
import { useTip } from './Tip';
import { check, scenario } from './envEngine';
import { dcls, envSelLabel, FACTOR_KEYS, ppD, r0, SCOND, scnName, sgn, vsAt, type EnvUi, type FactorKey } from './envUtil';

type Agg = Record<string, any>;
const barStyle = (v: number, w: number) => (v >= 0 ? { left: '50%', width: `${w}%`, background: 'var(--orange)' } : { right: '50%', width: `${w}%`, background: 'var(--bench-st)' });

export function ScenarioView({ u, set, games, lab }: { u: EnvUi; set: (p: Partial<EnvUi>) => void; games: Game[]; lab: (p: string) => string }) {
  const tip = useTip();
  const [st, setSt] = useState<{ cls: string; text: string } | null>(null);
  const sel = FACTOR_KEYS.filter((k) => u.scn[k] && u.scn[k] !== 'Any').map((k) => [k, u.scn[k]] as [FactorKey, string]);
  const R = useMemo(() => scenario(games, sel, u.eheat), [games, JSON.stringify(sel), u.eheat]); // eslint-disable-line react-hooks/exhaustive-deps
  const label = envSelLabel(u, games.length);
  const conds = (
    <div className="filters" style={{ margin: '10px 0 6px' }}>
      {FACTOR_KEYS.map((k) => (
        <div className="fgroup" key={k}><span className="label">{SCOND[k].label}</span><div className="seg" role="group">
          {[['Any', 'Any'], ...SCOND[k].opts].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={u.scn[k] === v} onClick={() => set({ scn: { ...u.scn, [k]: v } })}>{l}</button>
          ))}
        </div></div>
      ))}
    </div>
  );
  const note = <p className="note" style={{ margin: 0 }}>Pick the conditions of the next match. Each condition&apos;s effect = her minutes per match played in that condition minus the opposite (e.g. home minus away). <b>Environment Impact</b> = the effects added together. <b>Exact scenario</b> = her real minutes in past matches that had every selected condition, vs her season average.{u.scn.heat !== 'Any' ? ` Hot = ${u.eheat}°F+.` : ''}</p>;
  if (!sel.length) return <><section className="panel">{conds}{note}</section><section className="panel empty">Pick at least one condition.</section></>;

  const rows: Agg[] = R.rows;
  const mx = Math.max(10, ...rows.map((r) => Math.abs(r.score || 0)));
  const top = rows.filter((r) => !r.thin && r.score >= 3).slice(0, 3), bot = rows.filter((r) => !r.thin && r.score <= -3).slice(-3).reverse();
  const nc = sel.length;
  const pdf = async () => {
    setSt({ cls: '', text: 'Building PDF…' });
    try {
      downloadBlob(await scnPdf({ ...R, sel, name: scnName(sel), rows: rows.map((r) => ({ ...r, label: lab(r.p) })) }, label));
      setSt({ cls: 'ok', text: 'PDF downloaded.' });
    } catch (e) {
      setSt({ cls: 'err', text: (e as Error).message });
    }
  };
  return (
    <>
      <section className="panel">{conds}{note}</section>
      <section className="panel">
        <div className="gamehead" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Match scenario: {scnName(sel)}</h2>
          <button type="button" className="btn primary" disabled={!rows.length} onClick={pdf}>Download PDF for coaches</button></div>
        <p className="note" style={{ margin: '0 0 10px' }}>{label} · <b>{R.direct.length}</b> past match{R.direct.length === 1 ? '' : 'es'} with exactly this scenario{R.direct.length ? ` (${R.direct.map((g: Game) => g.opp).join(', ')})` : ''} · ranked by Environment Impact, highest first.{' '}
          {st && <span className="status"><span className={st.cls}>{st.text}</span></span>}</p>
        {(top.length > 0 || bot.length > 0) && <p style={{ margin: '0 0 12px' }}>
          {top.length > 0 && <><b>Highest Environment Impact:</b> {top.map((r) => `${lab(r.p)} (${sgn(r.score)})`).join(', ')}. </>}
          {bot.length > 0 && <><b>Lowest Environment Impact:</b> {bot.map((r) => `${lab(r.p)} (${sgn(r.score)})`).join(', ')}.</>}
        </p>}
        {rows.length ? (
          <div className="scn">
            <div className="sc-h" style={{ ['--nc' as string]: nc }}><span>#</span><span>Player</span>
              {sel.map(([k, v]) => <span key={k}>{SCOND[k].word[v]}<small>vs {SCOND[k].other[v]}</small></span>)}
              <span className="er-mid"><em>← less</em><em>more →</em></span><span>Env. Impact</span><span>Exact scenario</span></div>
            {rows.map((r, i) => {
              const w = Math.min(50, (Math.abs(r.score || 0) / mx) * 50);
              return (
                <div key={r.p} className={`sc-r${r.thin ? ' thin' : ''}`} style={{ ['--nc' as string]: nc }} {...tip(<>
                  <b>{lab(r.p)}</b> · season {r0(r.season)}&apos; per match ({r.n})<br />
                  {sel.map(([k, v]) => { const e = r.eff?.[k] ?? {}; return <div key={k}>{SCOND[k].word[v]} {r0(e.mi)}&apos; ({e.ni}) vs {SCOND[k].other[v]} {r0(e.mo)}&apos; ({e.no})</div>; })}
                  <b>Exact {scnName(sel)}</b>: {r.dN ? `${r0(r.dAvg)}' in ${r.dN} match${r.dN > 1 ? 'es' : ''}` : 'no matches yet'}
                  {r.thin && <><br /><i>Fewer than 2 matches on one side of a condition</i></>}
                </>)}>
                  <span className="tnum dim">{i + 1}</span><span><b>{lab(r.p)}</b>{r.gk && <> <span className="pos">GK</span></>}</span>
                  {sel.map(([k]) => { const d = r.eff?.[k]?.d; return <span key={k} className={`tnum ${dcls(d)}`}>{sgn(d)}</span>; })}
                  <span className="er-bar"><i style={barStyle(r.score, w)} /><b /></span>
                  <span className={`tnum er-d ${dcls(r.score)}`}>{sgn(r.score)}</span>
                  <span className="tnum sc-x">{r.dN ? <>{r0(r.dAvg)}&apos; <small>({r.dN})</small> <b className={dcls(r.dDelta)}>{sgn(r.dDelta)}</b>
                    {((r.dDelta >= 3 && r.score >= 3) || (r.dDelta <= -3 && r.score <= -3)) && <> <span className="sc-ok" title="Exact scenario agrees">✓</span></>}</> : <span className="dim">—</span>}</span>
                </div>
              );
            })}
          </div>
        ) : <div className="empty">No players have matches on both sides of every selected condition. Try fewer conditions or a wider match selection.</div>}
        <p className="note" style={{ marginTop: 8 }}>Environment Impact = sum of each condition&apos;s effect, minutes per match played. It ranks who benefits most from this combination; it isn&apos;t a minutes forecast (conditions share matches, so the sum overstates). ✓ = her real minutes in the exact scenario point the same way (3+ min). Faded rows have fewer than 2 matches on one side of a condition. Players need matches on both sides of every selected condition to be ranked{R.excluded ? ` (${R.excluded} not ranked)` : ''}. Conditions can overlap (e.g. most early kickoffs were also hot), so read the exact-scenario column as the reality check.</p>
      </section>
    </>
  );
}

export function ImpactCheck({ u, set, games, lab }: { u: EnvUi; set: (p: Partial<EnvUi>) => void; games: Game[]; lab: (p: string) => string }) {
  const tip = useTip();
  const c = u.chk;
  // pool group/result filter is applied inside the engine via egrp/eres
  const g = games.find((x) => x.id === c.id) ?? games[games.length - 1];
  const idx = games.indexOf(g);
  const all = useMemo(() => games.map((x) => ({ g: x, r: check(games, x, { inc: c.inc, data: c.data, eheat: u.eheat, egrp: u.egrp, eres: u.eres }) })),
    [games, c.inc, c.data, u.eheat, u.egrp, u.eres]);
  if (!g) return <section className="panel empty">No matches yet.</section>;
  const R = all.find((x) => x.g.id === g.id)!.r;
  const pct = (r: Agg) => (r.hits + r.miss ? Math.round((r.hits / (r.hits + r.miss)) * 100) : null);
  const tot = all.reduce((a, x) => ({ h: a.h + x.r.hits, m: a.m + x.r.miss, f: a.f + x.r.flat }), { h: 0, m: 0, f: 0 });
  const wT = all.filter((x) => x.r.topD != null && x.r.botD != null);
  const sTop = wT.length ? avg(wT.map((x) => x.r.topD)) : null, sBot = wT.length ? avg(wT.map((x) => x.r.botD)) : null;
  const sel: [FactorKey, string][] = R.sel;
  const nc = sel.length;
  const n = R.hits + R.miss + R.flat, sn = tot.h + tot.m + tot.f;
  const pc = (a: number, b: number) => (b ? Math.round((a / b) * 100) + '%' : '—');
  const go = (id: string) => set({ chk: { ...c, id } });
  const mx = Math.max(10, ...R.rows.map((r: Agg) => Math.abs(r.score || 0)));

  return (
    <>
      <section className="panel">
        <div className="filters" style={{ margin: '0 0 6px' }}>
          <div className="fgroup"><span className="label">Data window</span><div className="seg" role="group">
            <button type="button" aria-pressed={c.data === 'prior'} onClick={() => set({ chk: { ...c, data: 'prior' } })}>Only matches before it</button>
            <button type="button" aria-pressed={c.data === 'all'} onClick={() => set({ chk: { ...c, data: 'all' } })}>All other matches</button>
          </div></div>
          <div className="fgroup"><span className="label">Factors in the score</span><div className="seg" role="group">
            {FACTOR_KEYS.map((k) => <button key={k} type="button" aria-pressed={!!c.inc[k]} onClick={() => set({ chk: { ...c, inc: { ...c.inc, [k]: !c.inc[k] } } })}>{SCOND[k].label}</button>)}
          </div></div>
        </div>
        <p className="note" style={{ margin: 0 }}>Pick a match. Its own conditions are filled in automatically, the Environment Impact is projected exactly as in the Match scenario builder, and the right-hand columns show what each player actually played. <b>Only matches before it</b> is the fair test: the projection never sees the match it is checking. Season record: <b>{tot.h} right, {tot.m} wrong</b>{tot.h + tot.m ? ` (${Math.round((tot.h / (tot.h + tot.m)) * 100)}%)` : ''} across every match.
          {wT.length > 0 && <> Across those {wT.length} matches, the <b>top 5 by impact</b> played <b>{sgn(sTop)}</b> vs their average and the <b>bottom 5</b> played <b>{sgn(sBot)}</b>.</>}</p>
      </section>
      <section className="panel">
        <div className="gamehead" style={{ marginBottom: 8 }}><h3 style={{ margin: 0 }}>Pick a match · calls right per match</h3>
          <div className="form">
            <button type="button" className="btn" disabled={idx <= 0} onClick={() => go(games[idx - 1].id)}>← Previous</button>
            <button type="button" className="btn" disabled={idx >= games.length - 1} onClick={() => go(games[idx + 1].id)}>Next →</button>
          </div></div>
        <div className="picker">{all.map(({ g: x, r }) => {
          const p = pct(r);
          return (
            <button key={x.id} type="button" className="gchip" aria-pressed={x.id === g.id} onClick={() => go(x.id)}>
              <div className="g">{ppD(x)} · {vsAt(x)}</div><div className="o">{x.opp}</div>
              <div className="r"><span className={`res-${x.result}`}>{x.result} {x.gf}–{x.ga}</span> <span className={`ckp ${p == null ? '' : p >= 60 ? 'ok' : p < 45 ? 'bad' : ''}`}>{p == null ? '—' : p + '%'}</span></div>
            </button>
          );
        })}</div>
      </section>
      <section className="panel">
        <div className="gamehead" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Impact check: {ppD(g)} {vsAt(g)} {g.opp} <span className={`res-${g.result}`} style={{ fontSize: 18 }}>{g.result} {g.gf}–{g.ga}</span></h2>
          <div className="ckpct">
            <div className="ckpct-row"><span className="ok"><b>{pc(R.hits, n)}</b>right</span><span className="err"><b>{pc(R.miss, n)}</b>wrong</span><span className="neu"><b>{pc(R.flat, n)}</b>neutral</span></div>
            <div className="ckpct-sub">This match: {R.hits} right · {R.miss} wrong · {R.flat} neutral of {n} calls<br />Season: {pc(tot.h, sn)} right · {pc(tot.m, sn)} wrong · {pc(tot.f, sn)} neutral ({sn} calls)</div>
          </div>
        </div>
        <div className="ckcs">{FACTOR_KEYS.map((k) => {
          const v = R.v[k];
          const on = c.inc[k] && v;
          return <span key={k} className={`ckc ${on ? '' : 'off'}`}><b>{SCOND[k].label}</b> {v ? SCOND[k].opts.find((o) => o[0] === v)?.[1] ?? v : 'unknown'}{c.inc[k] ? '' : ' · left out'}</span>;
        })}</div>
        {R.rows.length > 0 && (
          <div className="kpis4" style={{ marginBottom: 12 }}>
            <div className="kpi"><div className="v">{R.hits}<small> / {R.hits + R.miss}</small></div><div className="k">Right vs wrong</div><div className="k dim" style={{ fontSize: 11.5 }}>{R.hits + R.miss ? Math.round((R.hits / (R.hits + R.miss)) * 100) + '% of right + wrong · ' : ''}{R.flat} neutral</div></div>
            <div className="kpi"><div className="v">{R.topD == null ? '—' : sgn(R.topD)}</div><div className="k">Top {R.nTop} by impact</div><div className="k dim" style={{ fontSize: 11.5 }}>actual vs their average</div></div>
            <div className="kpi"><div className="v">{R.botD == null ? '—' : sgn(R.botD)}</div><div className="k">Bottom {R.nTop} by impact</div><div className="k dim" style={{ fontSize: 11.5 }}>actual vs their average</div></div>
            <div className="kpi"><div className="v">{R.pool.length}</div><div className="k">Matches behind the projection</div><div className="k dim" style={{ fontSize: 11.5 }}>{c.data === 'prior' ? 'played before this one' : 'all other matches'}</div></div>
          </div>
        )}
        {!sel.length ? <div className="empty">Turn on at least one factor this match has data for.</div>
          : !R.rows.length ? <div className="empty">Not enough earlier matches to project this one{c.data === 'prior' ? ' (no players have matches on both sides of every factor before it). Try fewer factors or "All other matches"' : ''}.</div>
          : (
            <div className="scn">
              <div className="ck-h" style={{ ['--nc' as string]: nc }}><span>#</span><span>Player</span>
                {sel.map(([k, v]) => <span key={k}>{SCOND[k].word[v]}<small>vs {SCOND[k].other[v]}</small></span>)}
                <span className="er-mid"><em>← less</em><em>more →</em></span><span>Env. Impact</span><span>Avg before</span><span>Played</span><span>vs avg</span><span /></div>
              {R.rows.map((r: Agg, i: number) => {
                const w = Math.min(50, (Math.abs(r.score || 0) / mx) * 50);
                return (
                  <div key={r.p} className={`ck-r${r.thin ? ' thin' : ''}`} style={{ ['--nc' as string]: nc }} {...tip(<>
                    <b>{lab(r.p)}</b><br />
                    {sel.map(([k, v]) => { const e = r.eff?.[k] ?? {}; return <div key={k}>{SCOND[k].word[v]} {r0(e.mi)}&apos; ({e.ni}) vs {SCOND[k].other[v]} {r0(e.mo)}&apos; ({e.no})</div>; })}
                    Avg {r0(r.season)}&apos; per match played in {r.n} earlier match{r.n > 1 ? 'es' : ''}<br />
                    <b>This match:</b> {r.played ? `${r0(r.act)}' (${r.start ? 'started' : 'off the bench'})` : r.listed ? 'did not play' : 'not on the box score'}
                  </>)}>
                    <span className="tnum dim">{i + 1}</span><span><b>{lab(r.p)}</b>{r.gk && <> <span className="pos">GK</span></>}</span>
                    {sel.map(([k]) => { const d = r.eff?.[k]?.d; return <span key={k} className={`tnum ${dcls(d)}`}>{sgn(d)}</span>; })}
                    <span className="er-bar"><i style={barStyle(r.score, w)} /><b /></span>
                    <span className={`tnum er-d ${dcls(r.score)}`}>{sgn(r.score)}</span>
                    <span className="tnum muted">{r0(r.season)}&apos;</span>
                    <span className="tnum big">{r.played ? `${r0(r.act)}'` : <span className="dim" style={{ fontSize: 12 }}>{r.listed ? 'DNP' : '—'}</span>}{r.played && !r.start && <small className="dim">*</small>}</span>
                    <span className={`tnum ${dcls(r.delta)}`}>{r.delta == null ? '' : sgn(r.delta)}</span>
                    <span className="ckr">{r.res === 'hit' ? <b className="ok">✓</b> : r.res === 'miss' ? <b className="err">✗</b> : r.res === 'flat' ? <span className="dim">≈</span> : null}</span>
                  </div>
                );
              })}
            </div>
          )}
        <p className="note" style={{ marginTop: 8 }}>Env. Impact is projected from the {c.data === 'prior' ? 'matches before this one' : 'other matches'}, exactly as the Match scenario builder does it. Avg before = her minutes per match played in those matches. vs avg = what she played here minus that average. ✓ = the call was right (impact 3&apos;+ and she played 3&apos;+ more, or impact −3&apos; or lower and she played 3&apos;+ less); ✗ = the opposite happened; ≈ = within 3&apos; of her average. Players who didn&apos;t play and faded rows (fewer than 2 matches on one side of a factor) aren&apos;t counted. * = came off the bench.</p>
      </section>
    </>
  );
}

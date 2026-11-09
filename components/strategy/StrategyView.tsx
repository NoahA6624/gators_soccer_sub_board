'use client';
// Sub Strategy tab. Port of STGRP / stLabel / renderStrategy (L1905–1983) incl. the printable
// `.sheet`, plus restTeamPanel (L2166) and a "who comes on for whom" panel.
import { useEffect, useState } from 'react';
import { useBoard } from '@/lib/data/board';
import { avg, clk, stGames, stStats, type Agg } from '@/lib/engine';
import { downloadBlob, stPdf } from '@/lib/export';
import type { Game } from '@/lib/types';
import { Field, PosTag, Select, mmdd, nextSort, safeFull, secOf, sortRows, useNames, vsAt, type SortState } from './common';

export interface StUi { grp: string; role: 'All' | 'Start' | 'Bench'; res: string; ven: string; ko: string; heat: string; sort: SortState; rsort: SortState }
const DEF: StUi = { grp: 'all', role: 'All', res: 'All', ven: 'All', ko: 'All', heat: 'All', sort: { key: 'tot', dir: -1 }, rsort: { key: 'n', dir: -1 } };

export const STGRP: [string, string, (g: Game) => boolean][] = [
  ['all', 'All games', () => true],
  ['p4', 'Power 4', (g) => g.tier === 'P4'],
  ['ncp4', 'Non-conf Power 4', (g) => g.tier === 'P4' && !secOf(g)],
  ['sec', 'SEC', (g) => secOf(g)],
  ['nc', 'Non-conference', (g) => !secOf(g)],
  ['np4', 'Non-Power 4', (g) => g.tier !== 'P4'],
];

export interface StRow {
  p: string; first?: string; pos?: string; gp: number; gs: number;
  on1: number | null; off1: number | null; m1: number; on2: number | null; off2: number | null; m2: number;
  len2: number | null; n2: number; tot: number; h1n?: number; h2n?: number;
}

const STCOLS: Record<string, 1 | -1> = { p: 1, gp: -1, on1: -1, off1: -1, m1: -1, on2: -1, off2: -1, m2: -1, len2: -1, n2: -1, tot: -1 };
const stMin = (v: number | null | undefined) => (v == null ? '—' : Math.abs(v - 45) < 0.05 ? 'HT' : Math.round(v) + "'");
const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : null);
const stFmt: Record<string, (v: number | null) => string> = {
  on1: (v) => (v == null ? '—' : v < 0.05 ? '0' : Math.round(v) + "'"),
  off1: stMin, on2: stMin,
  off2: (v) => (v == null ? '—' : v >= 89.5 ? 'FT' : Math.round(v) + "'"),
  m1: (v) => (v == null ? '—' : Math.round(v) + ''), m2: (v) => (v == null ? '—' : Math.round(v) + ''),
  len2: (v) => (v == null ? '—' : Math.round(v) + "'"),
  n2: (v) => (v == null ? '—' : v.toFixed(1)),
  tot: (v) => (v == null ? '—' : Math.round(v) + ''),
};

/** Normalise whatever the engine returns (array of rows, or {rows}) into StRow[]. */
function toRows(st: unknown): StRow[] {
  const arr: Agg[] = Array.isArray(st) ? st : Array.isArray((st as Agg)?.rows) ? (st as Agg).rows : [];
  return arr.filter((r) => r && typeof r.p === 'string').map((r) => ({
    p: r.p, first: r.first, pos: r.pos, gp: +r.gp || 0, gs: +r.gs || 0,
    on1: num(r.on1), off1: num(r.off1), m1: +r.m1 || 0, on2: num(r.on2), off2: num(r.off2), m2: +r.m2 || 0,
    len2: num(r.len2), n2: +r.n2 || 0, tot: +r.tot || 0, h1n: r.h1n, h2n: r.h2n,
  }));
}

function stLabel(f: StUi, games: Game[], eheat: number) {
  const roleS = f.role !== 'All' ? (f.role === 'Start' ? ' · Starts only' : ' · Bench only') : '';
  if (f.grp.startsWith('g:')) {
    const g = games[0];
    return g ? `${vsAt(g)} ${g.opp} · ${g.date} · ${g.result} ${g.gf}–${g.ga}${f.role !== 'All' ? (f.role === 'Start' ? ' · Starters' : ' · Bench') : ''}` : '—';
  }
  if (f.grp === 'last3' || f.grp === 'last5') return `Last ${games.length} matches (${games.map((g) => `${mmdd(g.date)} ${vsAt(g)} ${g.opp}`).join(', ')})${roleS}`;
  const parts = [(STGRP.find((x) => x[0] === f.grp) ?? STGRP[0])[1]];
  if (f.role !== 'All') parts.push(f.role === 'Start' ? 'Starts only' : 'Bench only');
  if (f.res !== 'All') parts.push(({ W: 'Wins', T: 'Ties', L: 'Losses' } as Record<string, string>)[f.res] ?? f.res);
  if (f.ven !== 'All') parts.push(f.ven);
  if (f.ko !== 'All') parts.push(f.ko === 'Night' ? 'Night kickoffs' : 'Early kickoffs');
  if (f.heat !== 'All') parts.push(f.heat === 'Hot' ? `${eheat}°F+` : `Under ${eheat}°F`);
  return `${parts.join(' · ')} · ${games.length} match${games.length === 1 ? '' : 'es'}`;
}

/** Same selection rules as stGames (L1907) — used when the engine returns nothing usable. */
function localGames(all: Game[], f: StUi): Game[] {
  if (f.grp.startsWith('g:')) return all.filter((g) => g.id === f.grp.slice(2));
  if (f.grp === 'last3' || f.grp === 'last5') return all.slice(f.grp === 'last3' ? -3 : -5);
  const gf = (STGRP.find((x) => x[0] === f.grp) ?? STGRP[0])[2];
  return all.filter((g) => gf(g) && (f.res === 'All' || g.result === f.res) && (f.ven === 'All' || g.venue === f.ven));
}

export function StrategyView() {
  const { games: all, ui, setUi, loading } = useBoard();
  const names = useNames();
  const f: StUi = { ...DEF, ...((ui.strategy as Partial<StUi>) ?? {}) };
  const eheat = Number((ui.env as Agg | undefined)?.eheat) || 85;
  const save = (p: Partial<StUi>) => setUi('strategy', { ...f, ...p });
  const [status, setStatus] = useState('');

  // Original toggles body.print-st while on this view (L2414) so the print CSS applies.
  useEffect(() => {
    document.body.classList.add('print-st');
    return () => document.body.classList.remove('print-st');
  }, []);

  if (loading) return <div className="panel empty">Loading…</div>;

  const opts = { ...f, eheat };
  let games: Game[];
  try {
    const r = stGames(all, opts);
    games = Array.isArray(r) ? r : localGames(all, f);
  } catch { games = localGames(all, f); }
  let rows: StRow[] = [];
  try { rows = toRows(stStats(games, opts)); } catch { rows = []; }
  rows = sortRows(rows as unknown as Record<string, unknown>[], f.sort, 'tot', (r) => names.label(r.p as string)) as unknown as StRow[];

  const single = f.grp.startsWith('g:') || f.grp === 'last3' || f.grp === 'last5';
  const last = games.length ? games[games.length - 1] : null;
  const label = stLabel(f, games, eheat);

  const th = (k: string, l: React.ReactNode, cls = '', rowSpan?: number) => (
    <th className={`sortable ${cls}`} rowSpan={rowSpan} onClick={() => save({ sort: nextSort(f.sort, k, STCOLS[k] ?? -1) })}>
      {l}{f.sort.key === k && <span className="dir">{f.sort.dir === -1 ? '▼' : '▲'}</span>}
    </th>
  );
  const cell = (r: StRow, k: keyof StRow, cls: string) => <td className={cls}>{stFmt[k as string]((r[k] as number | null) ?? null)}</td>;

  const onPdf = async () => {
    setStatus('Building PDF…');
    try {
      const out = await stPdf(rows.map((r) => ({ ...r, name: names.label(r.p) })), label);
      downloadBlob(out);
      setStatus('');
    } catch (e) {
      setStatus(`Couldn't build the PDF (${(e as Error).message}). Use your browser's Print instead — the sheet is print-ready.`);
    }
  };

  return (
    <div className="stack">
      <section className="panel noprint">
        <div className="filters" style={{ margin: 0 }}>
          <Field label="Matches">
            <select value={f.grp} onChange={(e) => save({ grp: e.target.value })}>
              <optgroup label="Match groups">
                {STGRP.map(([k, l, fn]) => <option key={k} value={k}>{l} ({all.filter(fn).length})</option>)}
              </optgroup>
              <optgroup label="Short-term view">
                <option value="last3">Last 3 matches</option>
                <option value="last5">Last 5 matches</option>
              </optgroup>
              <optgroup label="Single match">
                {all.slice().reverse().map((g) => <option key={g.id} value={`g:${g.id}`}>{mmdd(g.date)} {vsAt(g)} {g.opp} ({g.result} {g.gf}–{g.ga})</option>)}
              </optgroup>
            </select>
          </Field>
          <Field label="Role"><Select value={f.role} onChange={(v) => save({ role: v as StUi['role'] })} options={[['All', 'All appearances'], ['Start', 'Starts only'], ['Bench', 'Bench only']]} /></Field>
          <Field label="Result"><Select value={f.res} disabled={single} onChange={(v) => save({ res: v })} options={[['All', 'All results'], ['W', 'Wins'], ['T', 'Ties'], ['L', 'Losses']]} /></Field>
          <Field label="Venue"><Select value={f.ven} disabled={single} onChange={(v) => save({ ven: v })} options={[['All', 'Home & away'], ['Home', 'Home'], ['Away', 'Away']]} /></Field>
          <Field label="Kickoff"><Select value={f.ko} disabled={single} onChange={(v) => save({ ko: v })} options={[['All', 'Any time'], ['Early', 'Early (before 5 PM)'], ['Night', 'Night (after 5 PM)']]} /></Field>
          <Field label="Heat"><Select value={f.heat} disabled={single} onChange={(v) => save({ heat: v })} options={[['All', 'Any temperature'], ['Hot', `Hot (${eheat}°F+)`], ['Cool', `Under ${eheat}°F`]]} /></Field>
          <div className="form" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn" type="button" onClick={() => window.print()}>Print</button>
            <button className="btn primary" type="button" onClick={onPdf}>Download PDF to print</button>
          </div>
        </div>
        <p className="note" style={{ margin: '8px 0 0' }}>Click any column header to sort before you print (first click = highest first; default is average total minutes). The PDF follows the filters and sort on screen. It&apos;s a one-page letter sheet: open it and print (portrait, 100% / actual size). <span className="status">{status}</span></p>
      </section>

      <div className="sheet" id="stSheet">
        <div className="sh-title">FLORIDA WOMEN&apos;S SOCCER <span>·</span> GATORS SUBBING STRATEGY</div>
        <div className="sh-meta">
          <span>Opponent: <i /></span><span>Date: <i className="short" /></span>
          <span className="sh-basis">Based on: <b>{label}</b>{last && !single ? ` · through ${mmdd(last.date)}` : ''}</span>
        </div>
        {games.length ? (
          <>
            <table className="sh-table">
              <colgroup><col style={{ width: '3%' }} /><col style={{ width: '21%' }} /><col style={{ width: '7%' }} /><col span={3} style={{ width: '6%' }} /><col span={5} style={{ width: '6.2%' }} /><col style={{ width: '8%' }} /><col style={{ width: '11%' }} /></colgroup>
              <thead>
                <tr><th rowSpan={2} className="h-ath">#</th>{th('p', 'Athlete', 'h-ath', 2)}{th('gp', <>GP<br />(GS)</>, 'h-ath', 2)}<th colSpan={3} className="h-1">1st half</th><th colSpan={5} className="h-2">2nd half</th><th className="h-t">Match</th><th rowSpan={2} className="h-n">Notes</th></tr>
                <tr>{th('on1', <>Avg<br />on</>, 's-1')}{th('off1', <>Avg<br />off</>, 's-1')}{th('m1', <>Avg<br />mins</>, 's-1')}{th('on2', <>Avg<br />on</>, 's-2')}{th('off2', <>Avg off<br />1st spell</>, 's-2')}{th('m2', <>Avg<br />mins</>, 's-2')}{th('len2', <>Spell<br />length</>, 's-2')}{th('n2', <>Avg<br />spells</>, 's-2')}{th('tot', <>Avg total<br />mins</>, 's-t')}</tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r, i) => (
                  <tr key={r.p} className={r.gs === 0 ? 'bench' : ''}>
                    <td className="c-n">{i + 1}</td>
                    <td className="c-a"><b>{names.label(r.p)}</b><PosTag pos={r.pos || names.pos(r.p)} /></td>
                    <td className="c-gp">{r.gp} ({r.gs})</td>
                    {cell(r, 'on1', 'c-1')}{cell(r, 'off1', 'c-1')}{cell(r, 'm1', 'c-1 c-m')}
                    {cell(r, 'on2', 'c-2')}{cell(r, 'off2', 'c-2')}{cell(r, 'm2', 'c-2 c-m')}{cell(r, 'len2', 'c-2')}{cell(r, 'n2', 'c-2')}
                    {cell(r, 'tot', 'c-t')}<td className="c-notes" />
                  </tr>
                )) : <tr><td colSpan={14} className="c-n">No player minutes for this selection yet.</td></tr>}
              </tbody>
            </table>
            <div className="sh-foot">Averages per match played. <b>On</b>: starters = 0. <b>HT</b> = through halftime (1st-half off) or on at the restart (2nd-half on). 1st-half on/off use only matches she played in that half. 2nd-half off = end of her first 2nd-half spell (FT = played to the final whistle). 2nd half counts re-subs, so a player who goes off and comes back has 2 spells. Avg mins: 1st half + 2nd half = avg total. Minutes from the official play-by-play; stoppage time not added. GP = matches played, GS = starts. Role filter: Starts only / Bench only use just those appearances. Shaded rows = did not start in this selection.</div>
          </>
        ) : <div className="empty">No matches fit these filters.</div>}
      </div>

      {games.length > 0 && <SubPairsPanel games={games} label={label} names={names} />}
      {games.length > 0 && <RestPanel games={games} f={f} label={label} names={names} onSort={(rsort) => save({ rsort })} />}
    </div>
  );
}

type Names = ReturnType<typeof useNames>;

/** "Who usually comes on for whom": in-play sub pairs across the selection. */
function SubPairsPanel({ games, label, names }: { games: Game[]; label: string; names: Names }) {
  const P: Record<string, { on: string; off: string; n: number; mins: number[]; ht: number; opps: string[] }> = {};
  games.forEach((g) => {
    const F = safeFull(g);
    (F?.subs ?? []).forEach((s) => {
      if (!s?.on || !s?.off) return;
      const k = `${s.on}|${s.off}`;
      const r = P[k] ?? (P[k] = { on: s.on, off: s.off, n: 0, mins: [], ht: 0, opps: [] });
      r.n++; r.mins.push(s.min); if (Math.abs(s.min - 45) < 0.05) r.ht++; r.opps.push(`${g.opp} ${clk(s.min)}`);
    });
  });
  const rows = Object.values(P).filter((r) => r.n >= (games.length > 1 ? 2 : 1)).sort((a, b) => b.n - a.n || (avg(a.mins) ?? 0) - (avg(b.mins) ?? 0)).slice(0, 15);
  return (
    <section className="panel noprint"><h2>Who usually comes on for whom</h2>
      <p className="note" style={{ margin: '-4px 0 12px' }}>{label} · direct swaps from the play-by-play{games.length > 1 ? ', pairs seen at least twice' : ''}. Hover a row for each match.</p>
      {rows.length ? (
        <div className="tablewrap"><table><thead><tr><th style={{ textAlign: 'left' }}>On</th><th style={{ textAlign: 'left' }}>For</th><th>Times</th><th>Usually around</th><th>At halftime</th></tr></thead><tbody>
          {rows.map((r) => (
            <tr key={`${r.on}|${r.off}`} title={r.opps.join('\n')}>
              <td style={{ textAlign: 'left' }}><span className="pname">{names.label(r.on)}</span></td>
              <td style={{ textAlign: 'left' }}><span className="muted">{names.label(r.off)}</span></td>
              <td className="tnum big">{r.n}</td>
              <td className="tnum">{Math.round(avg(r.mins) ?? 0)}&apos;</td>
              <td className="tnum">{r.ht || <span className="dim">0</span>}</td>
            </tr>
          ))}
        </tbody></table></div>
      ) : <div className="empty">No repeated sub pairs in this selection.</div>}
    </section>
  );
}

interface Rest { g: Game; off: number; on: number; len: number; back: number }
// restsOf / restAgg (L2161–2164), ported locally from spells.
function restsOfSpells(sp: [number, number][], g: Game): Rest[] {
  const out: Rest[] = [];
  for (let i = 0; i < sp.length - 1; i++) {
    const off = sp[i][1], on = sp[i + 1][0];
    if (on < 45 - 0.01 || off < 45 - 0.01) continue;
    out.push({ g, off, on, len: on - off, back: sp[i + 1][1] - on });
  }
  return out;
}

function RestPanel({ games, f, label, names, onSort }: { games: Game[]; f: StUi; label: string; names: Names; onSort: (s: SortState) => void }) {
  const P: Record<string, { p: string; apps: number; rs: Rest[] }> = {};
  games.forEach((g) => {
    const F = safeFull(g); const st = new Set((g.lineup?.starters ?? []).map((p) => p.name));
    Object.entries(F?.spells ?? {}).forEach(([p, sp]) => {
      if (f.role === 'Start' && !st.has(p)) return;
      if (f.role === 'Bench' && st.has(p)) return;
      const r = P[p] ?? (P[p] = { p, apps: 0, rs: [] });
      r.apps++; r.rs.push(...restsOfSpells(sp, g));
    });
  });
  const rows = sortRows(Object.values(P).filter((r) => r.rs.length).map((r) => {
    const max = r.rs.reduce((a, b) => (b.len > a.len ? b : a)), min = r.rs.reduce((a, b) => (b.len < a.len ? b : a));
    return { p: r.p, apps: r.apps, n: r.rs.length, avg: avg(r.rs.map((x) => x.len)), max: max.len, min: min.len, back: avg(r.rs.map((x) => x.back)), maxR: max, minR: min };
  }), f.rsort, 'n', (r) => names.label(r.p));
  const team = Object.values(P).flatMap((r) => r.rs.map((x) => ({ ...x, p: r.p })));
  const tMax = team.length ? team.reduce((a, b) => (b.len > a.len ? b : a)) : null;
  const m = (v: number | null) => (v == null ? <span className="dim">—</span> : Math.round(v) + "'");
  const ar = (k: string) => (f.rsort.key === k ? <span className="dir">{f.rsort.dir === -1 ? '↓' : '↑'}</span> : null);
  const th = (k: string, l: string, extra?: { rowSpan?: number; left?: boolean }) => (
    <th className="sortable" rowSpan={extra?.rowSpan} style={extra?.left ? { textAlign: 'left' } : undefined} onClick={() => onSort(nextSort(f.rsort, k, k === 'p' ? 1 : -1))}>{l} {ar(k)}</th>
  );
  const desc = (r: Rest) => `${Math.round(r.len)}' (${mmdd(r.g.date)} ${vsAt(r.g)} ${r.g.opp}, off ${clk(r.off)} → back ${clk(r.on)})`;
  return (
    <section className="panel noprint"><h2>Rest between spells · 2nd half</h2>
      <p className="note" style={{ margin: '-4px 0 12px' }}>Same filters as the sheet above ({label}). A rest is the match time between coming off and going back on, both in the 2nd half. Subbed off at halftime counts, with the rest starting at 45:00. Back for = how long she stayed on after returning.</p>
      {team.length > 0 && tMax && (
        <div className="kpis4" style={{ marginBottom: 12 }}>
          <div className="kpi"><div className="v">{team.length}</div><div className="k">2nd-half rests (team)</div><div className="k dim" style={{ fontSize: 11.5 }}>in {new Set(team.map((r) => r.g.id)).size} of {games.length} matches</div></div>
          <div className="kpi"><div className="v">{Math.round(avg(team.map((r) => r.len)) ?? 0)}<small>&apos;</small></div><div className="k">Avg rest</div></div>
          <div className="kpi"><div className="v">{Math.round(tMax.len)}<small>&apos;</small></div><div className="k">Longest</div><div className="k dim" style={{ fontSize: 11.5 }}>{tMax.g.opp} · {names.label(tMax.p)}</div></div>
          <div className="kpi"><div className="v">{Math.round(avg(team.map((r) => r.back)) ?? 0)}<small>&apos;</small></div><div className="k">Avg back for</div></div>
        </div>
      )}
      {rows.length ? (
        <>
          <div className="tablewrap"><table><thead>
            <tr>{th('p', 'Player', { rowSpan: 2, left: true })}{th('apps', 'Matches', { rowSpan: 2 })}<th colSpan={5} style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>Rests within the 2nd half</th></tr>
            <tr>{th('n', 'Rests')}{th('avg', 'Avg rest')}{th('max', 'Longest')}{th('min', 'Shortest')}{th('back', 'Back for (avg)')}</tr>
          </thead><tbody>
            {rows.map((r) => (
              <tr key={r.p} title={`${names.label(r.p)}\nLongest: ${desc(r.maxR)}\nShortest: ${desc(r.minR)}`}>
                <td style={{ textAlign: 'left' }}><span className="pname">{names.label(r.p)}</span></td>
                <td className="tnum">{r.apps}</td><td className="tnum">{r.n}</td>
                <td className="tnum big" style={{ color: 'var(--orange)' }}>{m(r.avg)}</td>
                <td className="tnum">{m(r.max)}</td><td className="tnum">{m(r.min)}</td><td className="tnum">{m(r.back)}</td>
              </tr>
            ))}
          </tbody></table></div>
          <p className="note">Click a column to sort. Hover a row for the matches behind the longest and shortest rest. Players with no rests in this selection aren&apos;t listed.</p>
        </>
      ) : <div className="empty">No rests between spells in this selection.</div>}
    </section>
  );
}

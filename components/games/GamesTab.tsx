'use client';
// Games tab. Port of renderGames (gator-sub-board.html L1064–1104).
import { useEffect, useMemo, useRef } from 'react';
import { useBoard } from '@/lib/data/board';
import { buildNameIndex, clk, fullD, halfD, HN, isSEC, playerLabel, posOf, RES, type SubRec } from '@/lib/engine';
import type { Game, Scope } from '@/lib/types';
import { MinutesPanel } from './MinutesPanel';

interface GamesUi { gameId?: string; msort?: { key: string; dir: number } }

function ScopeSeg({ scope, setScope }: { scope: Scope; setScope: (s: Scope) => void }) {
  return (
    <div className="fgroup">
      <span className="label">Match</span>
      <div className="seg" role="group">
        {(['h1', 'h2', 'full'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)}>{HN[k]}</button>
        ))}
      </div>
    </div>
  );
}

/** Group subs made at the same match second into one moment. */
function groupMoments(subs: SubRec[]): { t: number; min: number; subs: SubRec[] }[] {
  const out: { t: number; min: number; subs: SubRec[] }[] = [];
  [...subs].sort((a, b) => a.t - b.t).forEach((s) => {
    const last = out[out.length - 1];
    if (last && last.t === s.t) last.subs.push(s);
    else out.push({ t: s.t, min: s.min, subs: [s] });
  });
  return out;
}

export function GamesTab() {
  const { games, roster, scope, setScope, ui, setUi, loading } = useBoard();
  const idx = useMemo(() => buildNameIndex(games, roster), [games, roster]);
  const gu = (ui.games as GamesUi) || {};
  const sorted = useMemo(() => [...games].sort((a, b) => a.date.localeCompare(b.date)), [games]);
  const g: Game | undefined = sorted.find((x) => x.id === gu.gameId) ?? sorted[sorted.length - 1];
  const pickRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pickRef.current?.querySelector('.gchip[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [g?.id]);

  if (loading) return <div className="panel empty">Loading…</div>;
  if (!g) return <div className="panel empty">No matches yet. Add a match in Add data.</div>;

  const L = (p: string) => playerLabel(p, idx);
  const pos = (p: string) => posOf(p, games, roster);
  const PosTag = ({ p }: { p: string }) => (pos(p) ? <span className="pos">{pos(p)}</span> : null);
  const setGame = (id: string) => setUi('games', { ...gu, gameId: id });

  const F = fullD(g);
  const h = scope === 'h2' ? 2 : 1;
  const d = halfD(g, h);
  const ht = g.ht ?? { uf: 0, opp: 0 };

  const head = (
    <div className="gamehead">
      <div className="score">Florida <b>{g.gf}–{g.ga}</b> {g.opp}</div>
      <div className="meta">
        <span className={`pill ${g.result}`}>{RES[g.result]}</span>
        <span className="pill tier">{g.tier}</span>
        {isSEC(g) && <span className="pill tier">SEC</span>}
        <span className="pill plain">{g.venue}</span>
        <span className="tnum">{new Date(g.date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span className="tnum">· HT {ht.uf}–{ht.opp}</span>
        {g.source === 'manual' && <span className="pill plain">Tagged</span>}
      </div>
    </div>
  );

  // Every substitution moment, in order. Half scope: that half's in-play moments (L1064 subList); full: all subs.
  const moments = scope === 'full' ? groupMoments(F?.subs ?? []) : (d?.moments?.length ? d.moments : groupMoments(d?.subs ?? []));
  const starters = scope === 'full' ? null : d?.starters ?? [];
  let n = 0;
  const subList = moments.map((mo) => (
    <li className="moment" key={mo.t}>
      <div className="clock tnum">{clk(mo.min)}<small>{mo.subs.length} sub{mo.subs.length > 1 ? 's' : ''}</small></div>
      <div className="swaps">
        {mo.subs.map((s, i) => {
          n++;
          return (
            <div className="swap" key={i}>
              <span className="idx">{n}</span>
              <span className="off">{L(s.off)}</span><PosTag p={s.off} />
              <span className="arrow">off · on</span>
              <span className="on">{L(s.on)}</span><PosTag p={s.on} />
              {starters && !starters.includes(s.off) && <span className="tag">came on earlier this half</span>}
              <span className="state tnum"><b>{s.uf}–{s.opp}</b> {s.state}</span>
            </div>
          );
        })}
      </div>
    </li>
  ));

  let body;
  if (scope === 'full') {
    const spells = F?.spells ?? {};
    const END = F?.END ?? 90;
    const f90 = Object.entries(spells).filter(([, sp]) => sp.length === 1 && sp[0][0] === 0 && sp[0][1] >= END).map(([p]) => p);
    const d2 = halfD(g, 2);
    body = (
      <>
        <div className="kpis4">
          <div className="kpi"><div className="v tnum">{clk(halfD(g, 1)?.first)}</div><div className="k">First sub</div></div>
          <div className="kpi"><div className="v tnum">{F?.htSubs?.length ?? 0}</div><div className="k">Halftime changes</div></div>
          <div className="kpi"><div className="v tnum">{Object.keys(spells).length}</div><div className="k">Players used</div></div>
          <div className="kpi"><div className="v tnum">{f90.filter((p) => pos(p) !== 'GK').length}</div><div className="k">Outfield full 90s</div></div>
        </div>
        <div className="divider" />
        <h3>Every substitution · full match</h3>
        <ol className="order">{subList.length ? subList : <li className="empty">No subs this match.</li>}</ol>
        <p className="note" style={{ marginTop: 10 }}>
          {f90.length ? `Played all ${END}: ${f90.map(L).join(', ')}. ` : ''}
          {d2?.subs?.length ?? 0} in-play 2nd-half subs{d2?.first != null ? `, first at ${clk(d2.first)}` : ''}. Opponent made {F?.oppSubs?.length ?? 0} subs.
          {g.notes ? ' ' + g.notes : ''}
        </p>
      </>
    );
  } else {
    const bf = d?.first;
    const ufS = d?.ufShots ?? [], opS = d?.oppShots ?? [];
    const b = bf != null ? ufS.filter((t) => t < bf).length : 0, a = bf != null ? ufS.filter((t) => t >= bf).length : 0;
    const bo = bf != null ? opS.filter((t) => t < bf).length : 0, ao = bf != null ? opS.filter((t) => t >= bf).length : 0;
    const htSubs = F?.htSubs ?? [];
    const oppSubs = d?.oppSubs ?? [];
    body = (
      <>
        <div className="kpis4">
          {h === 2 && <div className="kpi"><div className="v tnum">{htSubs.length}</div><div className="k">Halftime changes</div></div>}
          <div className="kpi"><div className="v tnum">{clk(d?.first)}</div><div className="k">First {h === 2 ? 'in-play ' : ''}sub</div></div>
          <div className="kpi"><div className="v tnum">{d?.subs?.length ?? 0} <small>in {moments.length}</small></div><div className="k">Subs · moments</div></div>
          <div className="kpi"><div className="v tnum">{(d?.full ?? []).filter((p) => pos(p) !== 'GK').length}</div><div className="k">Outfield went the full half</div></div>
          {h === 1 && <div className="kpi"><div className="v tnum">{clk(d?.last)}</div><div className="k">Last sub</div></div>}
        </div>
        {h === 2 && (
          <>
            <div className="divider" />
            <h3>Halftime changes</h3>
            <div className="chips">
              {htSubs.length
                ? htSubs.map((s, i) => <span className="chip" key={i}><b>{L(s.on)}</b> on · {L(s.off)} off</span>)
                : <span className="dim">None</span>}
            </div>
          </>
        )}
        <div className="divider" />
        <h3>Order players came off{h === 2 ? ' · in play' : ''}</h3>
        <ol className="order">{subList.length ? subList : <li className="empty">No {h === 2 ? 'in-play ' : ''}subs this half.</li>}</ol>
        <div className="divider" />
        <div className="chips">
          <span className="label" style={{ marginRight: 4 }}>On at the {h === 2 ? 'restart' : 'start'} and played the full half</span>
          {(d?.full ?? []).map((p) => <span className="chip" key={p}>{L(p)}<PosTag p={p} /></span>)}
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          {bf != null && <>Shots before our first sub: <b>{b}–{bo}</b> · after: <b>{a}–{ao}</b>. </>}
          Opponent made {oppSubs.length} {h === 2 ? 'in-play ' : ''}subs{oppSubs.length ? `, first at ${clk(Math.min(...oppSubs))}` : ''}.
          {g.notes ? ' ' + g.notes : ''}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="filters"><ScopeSeg scope={scope} setScope={setScope} /></div>
      <div className="picker" role="group" aria-label="Choose a game" ref={pickRef}>
        {sorted.map((x, i) => (
          <button key={x.id} type="button" className="gchip" aria-pressed={x.id === g.id} onClick={() => setGame(x.id)}>
            <div className="g">G{i + 1} · {x.venue === 'Home' ? 'vs' : 'at'}{isSEC(x) ? ' · SEC' : ''}</div>
            <div className="o">{x.opp}</div>
            <div className={`r res-${x.result}`}>{x.result} {x.gf}–{x.ga}</div>
          </button>
        ))}
      </div>
      <div className="stack">
        <section className="panel">{head}{body}</section>
        <MinutesPanel g={g} games={sorted} />
      </div>
    </>
  );
}

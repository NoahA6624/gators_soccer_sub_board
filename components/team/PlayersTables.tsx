'use client';
// renderPlayersHalf (L1319–1341) and renderPlayersFull (L1342–1355).
import type { KeyboardEvent, ReactNode } from 'react';
import { clk, dm, type Agg, type NameIndex } from '@/lib/engine';
import { cmpPlayers, FGroup, fx, isNum, LaneAxis, LaneLegend, LaneSVG, PlayerName, rnd, Seg, Strip, arr, useTip } from '@/components/ui';
import { LaneTipBody } from './LaneTip';
import type { PlayersUi, SortState } from './playersUi';

const Arrow = ({ s, k }: { s: SortState; k: string }) => (s.key === k ? <span className="dir">{s.dir === -1 ? '↓' : '↑'}</span> : null);

function nextSort(cur: SortState, k: string, defDir: (k: string) => 1 | -1): SortState {
  return cur.key === k ? { key: k, dir: (cur.dir * -1) as 1 | -1 } : { key: k, dir: defDir(k) };
}

function rowProps(p: string, sel: string | null, onPick: (p: string) => void) {
  return {
    className: `click ${sel === p ? 'sel' : ''}`,
    tabIndex: 0,
    onClick: () => onPick(p),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter') onPick(p); },
  };
}

export function ModeSeg({ mode, onChange }: { mode: 'off' | 'on'; onChange: (m: 'off' | 'on') => void }) {
  return (
    <FGroup label="Show">
      <Seg<'off' | 'on'> options={[['off', 'Starters · subbed off'], ['on', 'Bench · subbed on']]} value={mode} onChange={onChange} />
    </FGroup>
  );
}

export function PlayersHalfTable({ P, h, idx, posFor, ui, setUi, onPick }: {
  P: Agg[]; h: 1 | 2; idx: NameIndex; posFor: (p: string) => string; ui: PlayersUi; setUi: (p: Partial<PlayersUi>) => void; onPick: (p: string) => void;
}): ReactNode {
  const off = ui.mode === 'off', lo = h === 1 ? 0 : 45, hi = h === 1 ? 45 : 90;
  const hasLoad = P.some((r) => arr(r.hsr).length);
  const offs = (r: Agg) => arr(r.offs), ons = (r: Agg) => arr(r.ons);
  const rows = P.filter((r) => (off ? (r.starts ?? 0) > 0 : ons(r).length > 0));
  const { key: k, dir: dd } = ui.sort;
  const cnt = (r: Agg) => (off ? r.starts ?? 0 : ons(r).length);
  const av = (r: Agg) => { const v = off ? r.avgOff : r.avgOn; return isNum(v) ? v : 999; };
  rows.sort((a, b) =>
    k === 'name' ? dd * cmpPlayers(a.p, b.p, idx)
      : k === 'avg' ? dd * (av(a) - av(b)) || cnt(b) - cnt(a)
        : dd * (cnt(a) - cnt(b)) || av(a) - av(b));
  const sortBy = (key: string) => setUi({ sort: nextSort(ui.sort, key, (x) => (x === 'avg' || x === 'name' ? 1 : -1)) });
  const th = (key: string, label: string) => (
    <th className="sortable" onClick={() => sortBy(key)}>{label} <Arrow s={ui.sort} k={key} /></th>
  );
  const stL = h === 2 ? 'On at restart' : 'Starts';
  if (!rows.length) return <div className="panel empty">No games match these filters.</div>;
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>
            {off ? (
              <tr>{th('name', 'Player')}{th('starts', stL)}<th>Subbed off</th>{th('avg', 'Avg off')}<th>Earliest</th><th>Latest</th>{hasLoad && <th>{h}H HSR/min</th>}<th>Each game, {lo}–{hi}&apos;</th></tr>
            ) : (
              <tr>{th('name', 'Player')}<th>Bench {h === 2 ? 'at restart' : 'apps'}</th>{th('starts', 'Entries')}{th('avg', 'Avg on')}<th>Earliest</th><th>Latest</th><th>Avg min</th>{hasLoad && <th>{h}H HSR/min</th>}<th>Each game, {lo}–{hi}&apos;</th></tr>
            )}
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p} {...rowProps(r.p, ui.player, onPick)}>
                <td><PlayerName p={r.p} idx={idx} pos={posFor(r.p)} /></td>
                {off ? (
                  <>
                    <td className="tnum">{r.starts}</td>
                    <td className="tnum">{offs(r).length ? `${offs(r).length} of ${r.starts}` : <span className="dim">Never · full half</span>}</td>
                    <td className="big tnum">{isNum(r.avgOff) ? dm(r.avgOff) : <span className="dim">—</span>}</td>
                    <td className="tnum">{clk(r.minOff)}</td>
                    <td className="tnum">{clk(r.maxOff)}</td>
                    {hasLoad && <td className="tnum">{fx(r.hsrPm)}</td>}
                    <td className="strip"><Strip points={offs(r)} avg={r.avgOff} full={r.full} lo={lo} hi={hi} /></td>
                  </>
                ) : (
                  <>
                    <td className="tnum">{r.apps ?? 0}</td>
                    <td className="tnum">{ons(r).length}</td>
                    <td className="big tnum">{dm(r.avgOn)}</td>
                    <td className="tnum">{clk(r.minOn)}</td>
                    <td className="tnum">{clk(r.maxOn)}</td>
                    <td className="tnum">{fx(r.avgMin)}</td>
                    {hasLoad && <td className="tnum">{fx(r.hsrPm)}</td>}
                    <td className="strip"><Strip points={ons(r)} avg={r.avgOn} full={0} lo={lo} hi={hi} /></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span><i className="sw" style={{ background: 'var(--orange)' }} />{off ? 'Came off' : 'Came on'} (one dot per game)</span>
        <span><i style={{ display: 'inline-block', width: 3, height: 14, background: 'var(--ink)', borderRadius: 2 }} />Average</span>
        {off && <span><i className="sw" style={{ border: '2px solid var(--blue)' }} />Played the full half</span>}
        <span>Click a player for her profile.</span>
      </div>
    </>
  );
}

export function PlayersFullTable({ FP, idx, posFor, ui, setUi, onPick }: {
  FP: Agg[]; idx: NameIndex; posFor: (p: string) => string; ui: PlayersUi; setUi: (p: Partial<PlayersUi>) => void; onPick: (p: string) => void;
}): ReactNode {
  const tip = useTip();
  const rows = FP.filter((r) => (r.g ?? 0) > 0);
  const { key: k, dir: d } = ui.fsort;
  const val = (r: Agg) => (k === 'min' ? r.minPg : k === 'spell' ? r.spellLen : r.g) ?? 0;
  rows.sort((a, b) => (k === 'name' ? d * cmpPlayers(a.p, b.p, idx) : d * (val(a) - val(b))));
  const sortBy = (key: string) => setUi({ fsort: nextSort(ui.fsort, key, (x) => (x === 'name' ? 1 : -1)) });
  const th = (key: string, label: string) => (
    <th className="sortable" onClick={() => sortBy(key)}>{label} <Arrow s={ui.fsort} k={key} /></th>
  );
  if (!rows.length) return <div className="panel empty">No games match these filters.</div>;
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>{th('name', 'Player')}{th('g', 'Games')}{th('min', 'Min / g')}<th>Spells / g</th>{th('spell', 'Avg spell')}<th>Full 90s</th><th style={{ minWidth: 360 }}><LaneAxis /></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p} {...rowProps(r.p, ui.player, onPick)} {...tip(<LaneTipBody r={r} idx={idx} />)} onClick={() => onPick(r.p)}>
                <td><PlayerName p={r.p} idx={idx} pos={posFor(r.p)} /></td>
                <td className="tnum">{r.g} <span className="dim">({r.starts ?? 0} st)</span></td>
                <td className="big tnum">{rnd(r.minPg)}</td>
                <td className="tnum">{fx(r.spellPg)}</td>
                <td className="tnum">{rnd(r.spellLen)}&apos;</td>
                <td className="tnum">{r.full90 || <span className="dim">0</span>}</td>
                <td style={{ minWidth: 360, paddingBlock: 4 }}><LaneSVG r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LaneLegend />
    </>
  );
}

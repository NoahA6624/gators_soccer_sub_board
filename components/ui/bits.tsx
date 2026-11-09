'use client';
// Small presentational bits shared across tabs.
//
//   <SectionLabel>Supplemental analysis</SectionLabel>  -> <div class="section-label">
//   <InsightList items={htmlStrings} idx={nameIdx} />   -> <ul class="insights"> numbered; engine HTML, names relabelled
//   <PlayerName p="Smith" idx={idx} pos="MID" />        -> <span class="pname">#19 - Mary Smith</span><span class="pos">MID</span>
//   <Kpi v="12.3'" k="Avg first sub" />                 -> <div class="kpi"><div class="v tnum">…</div><div class="k">…</div></div>
//   useNameIndex()                                      -> memoised buildNameIndex(games, roster)
import { useMemo, type ReactNode } from 'react';
import { useBoard } from '@/lib/data/board';
import { buildNameIndex, playerLabel, type NameIndex } from '@/lib/engine';
import { relabel } from './util';

export function useNameIndex(): NameIndex {
  const { games, roster } = useBoard();
  return useMemo(() => buildNameIndex(games, roster), [games, roster]);
}

export const SectionLabel = ({ children }: { children: ReactNode }) => <div className="section-label">{children}</div>;

export function InsightList({ items, idx }: { items: string[]; idx: NameIndex }) {
  return (
    <ul className="insights">
      {items.map((t, i) => (
        <li key={i}>
          <span className={`ic ${i % 2 ? 'o' : ''}`}>{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: relabel(t, idx) }} />
        </li>
      ))}
    </ul>
  );
}

export function PlayerName({ p, idx, pos }: { p: string; idx: NameIndex; pos?: string }) {
  return (
    <>
      <span className="pname">{playerLabel(p, idx)}</span>
      {pos ? <span className="pos">{pos}</span> : null}
    </>
  );
}

export function Kpi({ v, k }: { v: ReactNode; k: ReactNode }) {
  return (
    <div className="kpi">
      <div className="v tnum">{v}</div>
      <div className="k">{k}</div>
    </div>
  );
}

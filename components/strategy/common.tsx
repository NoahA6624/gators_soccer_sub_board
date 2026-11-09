'use client';
// Local helpers for the Sub Strategy + Bench tabs (agent H). Minimal stand-ins for shared
// controls being built in components/ui/ — swap to those once they land.
import { useMemo, type ReactNode } from 'react';
import { useBoard } from '@/lib/data/board';
import { buildNameIndex, fullD, isSEC, playerLabel, posOf, type NameIndex } from '@/lib/engine';
import type { Game, Roster } from '@/lib/types';

/** Name index + label/pos helpers for the current board. */
export function useNames() {
  const { games, roster } = useBoard();
  const idx = useMemo(() => buildNameIndex(games, roster), [games, roster]);
  return useMemo(() => makeNames(idx, games, roster), [idx, games, roster]);
}

export function makeNames(idx: NameIndex, games: Game[], roster: Roster) {
  return {
    idx,
    label: (last: string) => playerLabel(last, idx),
    pos: (last: string) => {
      try { return posOf(last, games, roster) || ''; } catch { return roster[last]?.pos ?? ''; }
    },
  };
}

/** Safe isSEC (engine may be a stub during development). */
export const secOf = (g: Game) => {
  try { return !!isSEC(g); } catch { return g.conf === 'SEC'; }
};

/** Safe fullD with an empty fallback. */
export const safeFull = (g: Game) => {
  try { return fullD(g); } catch { return null; }
};

export const vsAt = (g: Game) => (g.venue === 'Home' ? 'vs' : 'at');
export const mmdd = (d: string) => d.slice(5).replace('-', '/');

export function Seg<T extends string>({ options, value, onChange, counts }: {
  options: readonly (readonly [T, string])[];
  value: T | null;
  onChange: (v: T) => void;
  counts?: (v: T) => number;
}) {
  return (
    <div className="seg" role="group">
      {options.map(([k, l]) => {
        const n = counts?.(k);
        return (
          <button key={k} type="button" aria-pressed={value === k} disabled={n === 0} onClick={() => onChange(k)}>
            {l}{n != null && <> <span className="dim">{n}</span></>}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: React.CSSProperties }) {
  return <div className="field" style={style}><span className="label">{label}</span>{children}</div>;
}

export function Select({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function PosTag({ pos }: { pos: string }) {
  return pos ? <> <span className="pos">{pos}</span></> : null;
}

export type SortState = { key: string; dir: 1 | -1 };
export const nextSort = (cur: SortState, key: string, def: 1 | -1): SortState =>
  cur.key === key ? { key, dir: (cur.dir === 1 ? -1 : 1) } : { key, dir: def };

/** Generic sort, nulls last; ties broken by `tie` descending. */
export function sortRows<R extends Record<string, unknown>>(rows: R[], s: SortState, tie: string, strKey?: (r: R) => string): R[] {
  const v = (r: R) => (strKey && s.key === 'p' ? strKey(r) : r[s.key]);
  const t = (r: R) => (typeof r[tie] === 'number' ? (r[tie] as number) : 0);
  return rows.slice().sort((a, b) => {
    const x = v(a), y = v(b);
    if (x == null && y == null) return t(b) - t(a);
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'string' ? x.localeCompare(String(y)) : (x as number) - (y as number);
    return s.dir * c || t(b) - t(a);
  });
}

'use client';
// Shared filter controls (port of scopeSeg/filterBar/scopeLine, L786–797). Bound to useBoard().
//
//   <ScopeSeg />                          "Match" group: 1st half / 2nd half / Full match (useBoard().scope)
//   <FilterBar extra={node} scope={true}/> .filters row: [ScopeSeg] + Opponent tier, Result, Venue, Recent, then `extra`
//   <ScopeLine games={filteredGames} />    "<b>8</b> games · 5W 1T 2L · opp, opp…" (total = useBoard().games.length)
//   useHalf()                              -> 1 | 2 from scope (h2 → 2, else 1)
import type { ReactNode } from 'react';
import { useBoard } from '@/lib/data/board';
import { HN } from '@/lib/engine';
import type { Filters, Game, Scope } from '@/lib/types';
import { FGroup, Seg } from './Seg';

export const useHalf = (): 1 | 2 => (useBoard().scope === 'h2' ? 2 : 1);

export function ScopeSeg() {
  const { scope, setScope } = useBoard();
  return (
    <FGroup label="Match">
      <Seg<Scope> options={(['h1', 'h2', 'full'] as const).map((k) => [k, HN[k]] as const)} value={scope} onChange={setScope} />
    </FGroup>
  );
}

const TIER = [['All', 'All'], ['P4', 'Power 4'], ['SEC', 'SEC'], ['Non-P4', 'Non-P4']] as const;
const RESULT = [['All', 'All'], ['W', 'Wins'], ['T', 'Ties'], ['L', 'Losses']] as const;
const VENUE = [['All', 'All'], ['Home', 'Home'], ['Away', 'Away']] as const;
const RECENT = [['All', 'Season'], ['Last 5', 'Last 5'], ['Last 3', 'Last 3']] as const;

export function FilterBar({ extra, scope = true }: { extra?: ReactNode; scope?: boolean }) {
  const { filters, setFilters } = useBoard();
  return (
    <div className="filters">
      {scope && <ScopeSeg />}
      <FGroup label="Opponent">
        <Seg<Filters['tier']> options={TIER} value={filters.tier} onChange={(tier) => setFilters({ tier })} />
      </FGroup>
      <FGroup label="Result">
        <Seg<Filters['result']> options={RESULT} value={filters.result} onChange={(result) => setFilters({ result })} />
      </FGroup>
      <FGroup label="Venue">
        <Seg<Filters['venue']> options={VENUE} value={filters.venue} onChange={(venue) => setFilters({ venue })} />
      </FGroup>
      <FGroup label="Recent">
        <Seg<Filters['recent']> options={RECENT} value={filters.recent} onChange={(recent) => setFilters({ recent })} />
      </FGroup>
      {extra}
    </div>
  );
}

export function ScopeLine({ games }: { games: Game[] }) {
  const { filters: f, games: all } = useBoard();
  const W = games.filter((g) => g.result === 'W').length;
  const T = games.filter((g) => g.result === 'T').length;
  const L = games.length - W - T;
  const other = f.tier !== 'All' || f.result !== 'All' || f.venue !== 'All';
  return (
    <p className="scope">
      {f.recent && f.recent !== 'All' && (
        <>
          <b>{f.recent}</b>
          {other ? ' that match the filters' : ''} ·{' '}
        </>
      )}
      <b className="tnum">{games.length}</b> game{games.length === 1 ? '' : 's'} · {W}W {T}T {L}L
      {games.length > 0 && games.length < all.length && (
        <>
          {' · '}
          <span className="dim">{games.map((g) => g.opp).join(', ')}</span>
        </>
      )}
    </p>
  );
}

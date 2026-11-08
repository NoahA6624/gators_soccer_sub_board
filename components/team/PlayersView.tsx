'use client';
// renderPlayers (L1360): filters + halves/full table + inline profile (#profile).
import { useEffect, useMemo, useRef } from 'react';
import { useBoard } from '@/lib/data/board';
import { filtered, fullPlayerStats, playerStats, posOf } from '@/lib/engine';
import { FilterBar, ScopeLine, safe, TipProvider, toList, useNameIndex } from '@/components/ui';
import { ModeSeg, PlayersFullTable, PlayersHalfTable } from './PlayersTables';
import { Profile } from './Profile';
import { usePlayersUi } from './playersUi';

export function PlayersView() {
  const { games: all, loads, roster, filters, scope, loading, error } = useBoard();
  const idx = useNameIndex();
  const [ui, setUi] = usePlayersUi();
  const h: 1 | 2 = scope === 'h2' ? 2 : 1;
  const full = scope === 'full';
  const games = useMemo(() => safe(() => filtered(all, filters), all), [all, filters]);
  const P = useMemo(() => (full ? [] : toList(safe(() => playerStats(games, h, loads), []))), [full, games, h, loads]);
  const FP = useMemo(() => (full ? toList(safe(() => fullPlayerStats(games, loads), [])) : []), [full, games, loads]);
  const posFor = (p: string) => safe(() => posOf(p, all, roster), '');
  const profRef = useRef<HTMLDivElement>(null);

  const pick = (p: string) => setUi({ player: ui.player === p ? null : p });
  useEffect(() => {
    if (ui.player) profRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [ui.player]);

  if (loading) return <div className="panel empty">Loading…</div>;
  return (
    <TipProvider>
      {error && <div className="panel empty">{error}</div>}
      <FilterBar extra={full ? undefined : <ModeSeg mode={ui.mode} onChange={(mode) => setUi({ mode })} />} />
      <ScopeLine games={games} />
      <div id="profile" ref={profRef}>
        {ui.player && <Profile p={ui.player} scope={scope} idx={idx} onClose={() => setUi({ player: null })} />}
      </div>
      {!all.length ? (
        <div className="panel empty">No games yet. Add a game to get started.</div>
      ) : full ? (
        <PlayersFullTable FP={FP} idx={idx} posFor={posFor} ui={ui} setUi={setUi} onPick={pick} />
      ) : (
        <PlayersHalfTable P={P} h={h} idx={idx} posFor={posFor} ui={ui} setUi={setUi} onPick={pick} />
      )}
    </TipProvider>
  );
}

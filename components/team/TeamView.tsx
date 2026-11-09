'use client';
// renderTeam (L1000): halves vs full match by scope.
import { useBoard } from '@/lib/data/board';
import { TipProvider } from '@/components/ui';
import { TeamFull } from './TeamFull';
import { TeamHalf } from './TeamHalf';

export function TeamView() {
  const { scope, loading, error } = useBoard();
  if (loading) return <div className="panel empty">Loading…</div>;
  return (
    <TipProvider>
      {error && <div className="panel empty">{error}</div>}
      {scope === 'full' ? <TeamFull /> : <TeamHalf h={scope === 'h2' ? 2 : 1} />}
    </TipProvider>
  );
}

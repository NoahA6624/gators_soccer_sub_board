'use client';
import { useBoard } from '@/lib/data/board';

export function Subtitle() {
  const { games } = useBoard();
  const last = games.length ? games[games.length - 1].date : null;
  return <p id="sub">UF Women&apos;s Soccer · {games.length ? `${games.length} games through ${last}` : 'substitution patterns'}</p>;
}

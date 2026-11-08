// Synthetic, hand-built games for engine tests. All names/numbers are made up.
import type { Game, GameEvent, LineupPlayer } from '@/lib/types';

const toT = (clock: string) => { const [m, s] = clock.split(':').map(Number); return m * 60 + s; };
export const ev = (half: number, clock: string, type: GameEvent['type'], x: Partial<GameEvent> = {}): GameEvent =>
  ({ half, clock, t: toT(clock), type, team: 'UF', ...x });
export const sub = (half: number, clock: string, on: string, off: string, team: 'UF' | 'OPP' = 'UF') => ev(half, clock, 'SUB', { on, off, team });

const P = (name: string, num: string, first: string, pos: LineupPlayer['pos'] = 'MID'): LineupPlayer => ({ name, num, first, pos });
export const STARTERS = (): LineupPlayer[] => [
  P('Keeper', '1', 'Kay', 'GK'), P('Alder', '2', 'Ann', 'DEF'), P('Birch', '5', 'Bea', 'DEF'), P('Cedar', '6', 'Cat'), P('Dogwood', '7', 'Dee'),
  P('Elm', '8', 'Eve'), P('Fir', '9', 'Fay', 'FWD'), P('Gum', '10', 'Gia'), P('Hazel', '11', 'Hal'), P('Ivy', '12', 'Ida'), P('Juniper', '13', 'Jo', 'FWD'),
];
export const BENCH = (): LineupPlayer[] => [P('Kapok', '14', 'Kim'), P('Larch', '15', 'Liv'), P('Maple', '16', 'May'), P('Nutmeg', '17', 'Nia')];

const base = (id: string, date: string, events: GameEvent[], extra: Partial<Game> = {}): Game => ({
  id, date, opp: 'Testville', venue: 'Home', gf: 1, ga: 0, result: 'W', tier: 'P4', conf: 'Non-conf',
  lineup: { starters: STARTERS(), bench: BENCH() }, events, ...extra,
});

/** Regulation: 1H subs, goal at the same second as a sub, two halftime changes (one logged as half 1),
 *  2H re-entry, a sub whose `off` isn't on the field, and a red card. */
export const gameA = () => base('2026-09-03-testville', '2026-09-03', [
  sub(1, '20:00', 'Kapok', 'Alder'),
  ev(1, '30:00', 'GOAL', { player: 'Birch' }),
  sub(1, '30:00', 'Larch', 'Cedar'),
  ev(1, '33:00', 'SHOT', { player: 'Fir' }),
  sub(1, '45:00', 'Maple', 'Dogwood'), // halftime change logged in half 1
  sub(2, '45:00', 'Alder', 'Kapok'), // halftime change, Alder re-enters
  sub(2, '60:00', 'Cedar', 'Larch'), // 2H re-entry
  sub(2, '65:00', 'Nutmeg', 'Ghost'), // bad data: Ghost isn't on the field
  ev(2, '70:00', 'CARD', { card: 'red', player: 'Elm' }),
  sub(2, '72:00', 'X1', 'Y1', 'OPP'),
]);

/** Double overtime: 2H sub, then break changes at both OT restarts (re-entry), OT goal. */
export const gameB = () => base('2026-09-06-otown', '2026-09-06', [
  sub(2, '70:00', 'Kapok', 'Fir'),
  sub(3, '90:00', 'Fir', 'Gum'), // break change at the 1st OT restart (Fir re-enters)
  ev(3, '95:00', 'GOAL', { team: 'OPP', player: 'Opp9' }),
  ev(3, '97:00', 'SHOT', { player: 'Juniper' }),
  sub(4, '100:00', 'Gum', 'Hazel'), // break change at the 2nd OT restart (Gum re-enters)
], { opp: 'Otown', gf: 0, ga: 1, result: 'L', venue: 'Away' });

/** Plain regulation game with standard halftime changes only. */
export const gameC = () => base('2026-09-10-plainview', '2026-09-10', [
  sub(1, '25:00', 'Kapok', 'Hazel'),
  sub(2, '45:00', 'Hazel', 'Kapok'),
  sub(2, '45:00', 'Larch', 'Ivy'),
  sub(2, '75:00', 'Maple', 'Juniper'),
], { opp: 'Plainview', gf: 2, ga: 2, result: 'T' });

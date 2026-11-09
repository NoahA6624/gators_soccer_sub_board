// Synthetic fixtures only: made-up players, numbers and opponents.
import type { Game } from '@/lib/types';
import type { TextItem } from '../pdfParse';

export const sampleGame: Game = {
  id: '2025-09-04-fake-state', date: '2025-09-04', opp: 'Fake State', venue: 'Away', tier: 'Non-P4', conf: 'Non-conf',
  gf: 2, ga: 1, result: 'W', ht: { uf: 1, opp: 0 }, source: 'manual',
  lineup: {
    starters: [
      { name: 'Alpha', first: 'Ann', num: '1', pos: 'GK' },
      { name: 'Bravo', first: 'Bea', num: '7', pos: 'MID' },
      { name: 'Comma, Jr', first: 'Cat "CJ"', num: '9', pos: 'FWD' },
    ],
    bench: [{ name: 'Delta', first: 'Dee', num: '22', pos: 'DEF' }],
  },
  events: [
    { half: 1, clock: '12:30', t: 750, type: 'SHOT', team: 'UF', player: 'Bravo', sog: true },
    { half: 1, clock: '20:00', t: 1200, type: 'GOAL', team: 'UF', player: 'Bravo' },
    { half: 1, clock: '30:05', t: 1805, type: 'CARD', team: 'OPP', player: 'Zulu', card: 'yellow' },
    { half: 2, clock: '50:00', t: 3000, type: 'SUB', team: 'UF', on: 'Delta', off: 'Bravo' },
    { half: 2, clock: '60:00', t: 3600, type: 'GOAL', team: 'OPP', player: 'Yankee', pk: true },
    { half: 2, clock: '70:00', t: 4200, type: 'SHOT', team: 'OPP', player: 'Yankee' },
    { half: 2, clock: '80:00', t: 4800, type: 'CARD', team: 'UF', player: 'Delta', card: 'red' },
    { half: 2, clock: '85:00', t: 5100, type: 'GOAL', team: 'UF', player: 'Comma, Jr' },
  ],
};

/** Synthetic Format B ("Official Soccer Box Score") page. Left column = Florida, right = opponent (x >= 300). */
export function formatBPage(): TextItem[] {
  let y = 800;
  const out: TextItem[] = [];
  const line = (...cells: [number, string][]) => { cells.forEach(([x, str]) => out.push({ str, x, y })); y -= 12; };
  line([10, 'Official Soccer Box Score']);
  line([10, 'Florida vs Fake State']);
  line([10, '9/4/2025 Orlando, Fla.']);
  line([10, 'Match Time: 7:00 PM']);
  line([10, 'Florida'], [300, 'Fake State']);
  line([10, 'Pos ## Player SH SOG G A PTS MIN'], [300, 'Pos ## Player SH SOG G A PTS MIN']);
  line([10, 'GK 1 Ann Alpha - - - - - 90'], [300, 'GK 30 Zed Zulu - - - - - 90']);
  line([10, 'MID 7 Bea Bravo 3 2 1 - 2 50'], [300, 'FWD 31 Yara Yankee 2 1 1 - 2 90']);
  line([10, 'Substitutes'], [300, 'Substitutes']);
  line([10, 'DEF 22 Dee Delta 1 1 - - - 40']);
  line([10, 'Totals 4 3 1 0 2 180'], [300, 'Totals 2 1 1 0 2 180']);
  line([10, 'Florida Starters:'], [300, 'Fake State Starters:']);
  line([10, 'GK 1 Alpha, Ann'], [300, 'GK 30 Zulu, Zed']);
  line([10, 'MID 7 Bravo, Bea'], [300, 'FWD 31 Yankee, Yara']);
  line([10, '00:00 Start of 1st period']);
  line([10, '12:30 Shot by Gators Bravo, Bea, SAVE Zulu, Zed.']);
  line([10, '20:00 Shot by Gators Bravo, Bea, GOAL.']);
  line([10, '20:00 GOAL by Gators Bravo, Bea, Assist by Alpha, Ann']);
  line([10, '30:05 Yellow card on Owls Zulu, Zed.']);
  line([10, '45:00 End of period [45:00]']);
  line([10, '50:00 Gators substitution: Delta, Dee for Bravo, Bea.']);
  line([10, '60:00 Owls Yankee, Yara PENALTY KICK GOAL']);
  line([10, '62:00 Corner kick by Owls [62:00].']);
  line([10, '88:00 Shot by Gators Delta, Dee, GOAL.']);
  line([10, '90:00 End of period [90:00]']);
  return out;
}

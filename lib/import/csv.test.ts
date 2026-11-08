import { describe, it, expect } from 'vitest';
import { csvParse, gamesFromTagCsv } from './index';
import { gamesToCsvText } from '@/lib/export';
import { sampleGame } from './__fixtures__/synthetic';

describe('tag CSV round-trip', () => {
  it('export → import equals the original (lineup, pk, sog, cards, id)', () => {
    const back = gamesFromTagCsv(gamesToCsvText([sampleGame]));
    expect(back).toHaveLength(1);
    const g = back[0];
    expect(g.id).toBe(sampleGame.id);
    expect(g.lineup).toEqual(sampleGame.lineup);
    expect(g.events).toEqual(sampleGame.events);
    expect([g.gf, g.ga, g.result, g.ht]).toEqual([2, 1, 'W', { uf: 1, opp: 0 }]);
    expect([g.date, g.opp, g.venue, g.tier, g.conf]).toEqual([sampleGame.date, sampleGame.opp, 'Away', 'Non-P4', 'Non-conf']);
  });
  it('honors game_id: two games on the same date/opponent stay separate', () => {
    const b = { ...sampleGame, id: sampleGame.id + '-2' };
    expect(gamesFromTagCsv(gamesToCsvText([sampleGame, b])).map((g) => g.id)).toEqual([sampleGame.id, b.id]);
  });
  it('guards formula-like strings on export and strips the guard on import', () => {
    const evil = { ...sampleGame, opp: '=HYPERLINK("x","y")' };
    const text = gamesToCsvText([evil]);
    expect(text).toContain(`"'=HYPERLINK(""x"",""y"")"`);
    expect(gamesFromTagCsv(text)[0].opp).toBe(evil.opp);
  });
  it('csvParse keeps commas and newlines inside quoted fields', () => {
    expect(csvParse('a,"b, c","d\n""e"""\n1,2,3')).toEqual([['a', 'b, c', 'd\n"e"'], ['1', '2', '3']]);
  });
  it('falls back to date|opponent and derived id without game_id', () => {
    const csv = 'date,opponent,type,half,clock,team,player,detail\n2025-10-01,Made Up U,GOAL,1,10:00,UF,Bravo,pk\n';
    const [g] = gamesFromTagCsv(csv);
    expect(g.id).toBe('2025-10-01-made-up-u');
    expect(g.events[0]).toMatchObject({ type: 'GOAL', pk: true, t: 600 });
  });
});

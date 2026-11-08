import { describe, expect, it } from 'vitest';
import { gameA, gameB, gameC } from './__fixtures__/games';
import {
  benchOf, buildNameIndex, chkRun, envOf, envPlayers, fullD, fullInsights, fullPlayerStats, fullTeamStats, halfD, insights,
  minutesData, minutesRows, patternText, playerStats, ppAgg, ppRec, ppWeek, restAgg, restsOf, roleOf, scnCompute, stGames, stStats, teamStats,
} from './index';

const close = (o: Record<string, number>, exp: Record<string, number>) => {
  for (const [k, v] of Object.entries(exp)) expect(o[k], k).toBeCloseTo(v, 6);
};

describe('golden: gameA (regulation, HT changes, re-entry, red card)', () => {
  const g = gameA();
  const F = fullD(g);
  it('spells', () => {
    expect(F.END).toBe(90);
    expect(F.spells.Alder).toEqual([[0, 20], [45, 90]]);
    expect(F.spells.Kapok).toEqual([[20, 45]]);
    expect(F.spells.Cedar).toEqual([[0, 30], [60, 90]]);
    expect(F.spells.Larch).toEqual([[30, 60]]);
    expect(F.spells.Dogwood).toEqual([[0, 45]]);
    expect(F.spells.Maple).toEqual([[45, 90]]);
    expect(F.spells.Elm).toEqual([[0, 70]]);
    expect(F.spells.Keeper).toEqual([[0, 90]]);
  });
  it('minutes', () => {
    close(F.mins, { Keeper: 90, Alder: 65, Kapok: 25, Birch: 90, Cedar: 60, Larch: 30, Dogwood: 45, Maple: 45, Elm: 70, Fir: 90 });
    const h1 = halfD(g, 1), h2 = halfD(g, 2);
    close(h1.minH, { Alder: 20, Kapok: 25, Cedar: 30, Larch: 15, Dogwood: 45 });
    close(h2.minH, { Alder: 45, Cedar: 30, Larch: 15, Maple: 45, Elm: 25 });
    expect(h2.minH.Kapok).toBeUndefined();
    expect(h2.minH.Dogwood).toBeUndefined();
  });
  it('minutesRows', () => {
    const d = minutesData(g);
    expect(d.unused).toEqual(['Nutmeg']);
    const alder = minutesRows(g).find((r) => r.p === 'Alder')!;
    expect(alder).toMatchObject({ m1: 20, m2: 45, full: 65, role: 'Start', spells: '0:00–20:00, 45:00–90:00' });
  });
  it('does not write cache onto the game object', () => {
    halfD(g, 1); halfD(g, 2);
    expect(Object.keys(g).some((k) => k.startsWith('_'))).toBe(false);
    expect(fullD(g)).toBe(F);
  });
});

describe('golden: gameB (double OT)', () => {
  const g = gameB();
  const F = fullD(g);
  it('END/restarts and spells', () => {
    expect(F.END).toBe(110);
    expect(F.restarts).toEqual([0, 45, 90, 100]);
    expect(F.spells.Fir).toEqual([[0, 70], [90, 110]]);
    expect(F.spells.Gum).toEqual([[0, 90], [100, 110]]);
    expect(F.spells.Hazel).toEqual([[0, 100]]);
    close(F.mins, { Fir: 90, Kapok: 40, Gum: 100, Hazel: 100, Keeper: 110, Ivy: 110 });
  });
  it('OT restart subs are break changes, not in-play', () => {
    expect(F.otSubs.map((s) => s.on)).toEqual(['Fir', 'Gum']);
    expect(F.inplay2.map((s) => s.on)).toEqual(['Kapok']);
    expect(F.htSubs).toEqual([]);
  });
});

describe('golden: gameC (standard halftime)', () => {
  const g = gameC();
  const F = fullD(g);
  it('spells + minutes', () => {
    expect(F.spells.Hazel).toEqual([[0, 25], [45, 90]]);
    close(F.mins, { Hazel: 70, Kapok: 20, Ivy: 45, Larch: 45, Juniper: 75, Maple: 15 });
    expect(F.htSubs.length).toBe(2);
    expect(halfD(g, 2).starters).toContain('Hazel');
    expect(halfD(g, 2).subs.map((s) => s.on)).toEqual(['Maple']);
  });
});

describe('bug fixes', () => {
  it('1: halftime sub logged as half 1 at 45:00 is a halftime change', () => {
    const F = fullD(gameA());
    expect(F.htSubs.map((s) => s.on).sort()).toEqual(['Alder', 'Maple']);
    expect(halfD(gameA(), 1).subs.map((s) => s.on)).toEqual(['Kapok', 'Larch']);
    expect(F.inplay2.map((s) => s.on)).toEqual(['Cedar', 'Nutmeg']);
  });
  it('1: OT restart subs are excluded from in-play counts', () => {
    expect(fullTeamStats([gameB()]).ip).toBe(1);
  });
  it('2: sub whose off is not on the field does not add a 12th player; records a warning', () => {
    const F = fullD(gameA());
    expect(F.spells.Nutmeg).toBeUndefined();
    expect(F.warnings.some((w) => w.includes('Ghost'))).toBe(true);
    expect(fullD(gameC()).warnings).toEqual([]);
  });
  it('3: goal at the same second as a sub counts after the sub', () => {
    const s = halfD(gameA(), 1).subs.find((x) => x.on === 'Larch')!;
    expect(s.state).toBe('Level');
    expect([s.uf, s.opp]).toEqual([0, 0]);
    expect(fullD(gameA()).scoreAt(30.01)).toEqual({ uf: 1, opp: 0 });
    expect(halfD(gameA(), 2).subs[0].state).toBe('Winning');
  });
  it('4: 2nd-half stats are regulation [45,90] in halfD and teamStats', () => {
    const g = gameB();
    const h2 = halfD(g, 2);
    expect(h2.hi).toBe(90);
    close(h2.minH, { Fir: 25, Kapok: 20, Gum: 45, Keeper: 45 });
    expect(h2.oppGoals).toEqual([]); // OT goal belongs only to full-match views
    expect(teamStats([g], 2).hi).toBe(90);
    expect(fullD(g).oppGoals).toEqual([95]);
  });
  it('5: red-carded starter does not count as a full half', () => {
    const g = gameA();
    expect(halfD(g, 2).full).not.toContain('Elm');
    expect(halfD(g, 2).full).not.toContain('Larch');
    expect(halfD(g, 2).full).toContain('Keeper');
    expect(halfD(g, 1).full).toContain('Elm');
    expect(playerStats([g], 2).Elm.full).toBe(0);
  });
});

describe('aggregates smoke', () => {
  const games = [gameA(), gameB(), gameC()];
  it('full player stats + pattern/role', () => {
    const P = fullPlayerStats(games);
    expect(P.Keeper.full90).toBe(3);
    expect(P.Alder.retHT).toBe(1);
    expect(patternText(P.Birch)).toMatch(/full 90/);
    expect(roleOf(P.Keeper, { allGames: games })).toBe('gk');
    expect(roleOf(P.Birch, { allGames: games })).toBe('anchor');
  });
  it('insights use playerLabel when a NameIndex is given', () => {
    const names = buildNameIndex(games);
    const txt = insights(games, 1, { names }).join('\n');
    expect(txt).toContain('#5 - Bea Birch');
    expect(insights(games, 1).join('\n')).not.toContain('#5 - Bea Birch');
    expect(fullInsights(games, { names }).join('\n')).toContain('#5 - Bea Birch');
  });
  it('tab engines run', () => {
    expect(benchOf(games[0]).uf.N).toBe(3);
    expect(benchOf(games).length).toBe(3);
    const recs = ppRec(games, 'Alder');
    expect(ppAgg(recs).apps).toBe(3);
    expect(ppWeek(games, 'Alder')).toMatchObject({ one: { apps: 1 }, two: { apps: 2 } });
    const rs = restsOf(games, 'Cedar');
    expect(rs).toEqual([]); // Cedar's rest starts in the 1st half
    expect(restAgg(restsOf([gameB()], 'Gum'))).toMatchObject({ n: 1, avg: 10 });
    expect(stGames(games, { grp: 'all', res: 'W' }).length).toBe(1);
    expect(stStats(games, { role: 'Start' }).find((r) => r.p === 'Keeper')!.gp).toBe(3);
    expect(envOf(gameA()).night).toBeNull();
    expect(envPlayers(games, 'venue').find((r) => r.p === 'Keeper')!.A.apps).toBe(2);
    expect(scnCompute(games, { venue: 'Home' }).direct.length).toBe(2);
    expect(chkRun(games, { data: 'all', inc: { venue: true, time: false, heat: false, week: false } })!.sel).toEqual([['venue', 'Home']]);
  });
});

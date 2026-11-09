// Player analysis bullet points. Port of ppInsights (gator-sub-board.html L2366–2406).
// Returns [heading, html] pairs; every interpolated string is escaped. Render with dangerouslySetInnerHTML.
import { avg, clk, envOf, ppAgg, restsOf, type Agg } from '@/lib/engine';
import type { Game } from '@/lib/types';
import { esc, PPBINS, ppD, ppG, wkInfo } from './helpers';

type Rec = Agg;
const spOf = (r: Rec): [number, number][] => (Array.isArray(r?.sp) ? r.sp : []);

export function ppInsights(p: string, recs: Rec[], allGames: Game[], eheat = 85): [string, string][] | null {
  const P = recs.filter((r) => r?.played && spOf(r).length);
  if (!P.length) return null;
  const out: [string, string][] = [];
  const m = (v: number | null | undefined) => (v == null || isNaN(v) ? '—' : Math.round(v) + "'");
  const rng = (a: number[]) => (a.length > 1 ? ` (range ${m(Math.min(...a))}–${m(Math.max(...a))})` : '');
  const ST = P.filter((r) => r.start), BE = P.filter((r) => !r.start);

  // role
  const avgM = avg(P.map((r) => r.min)) ?? 0;
  out.push(['Role', `Played <b>${P.length} of ${recs.length}</b> matches, <b>${ST.length} start${ST.length === 1 ? '' : 's'}</b>${BE.length ? ` and ${BE.length} off the bench` : ''}, averaging <b>${m(avgM)}</b> per match played (${m(avg(P.map((r) => r.h1)))} 1st half, ${m(avg(P.map((r) => r.h2)))} 2nd half).`]);

  // starters: 1st-half exit
  if (ST.length) {
    const ex = ST.filter((r) => spOf(r)[0][0] === 0 && spOf(r)[0][1] < 45 - 0.01).map((r) => spOf(r)[0][1]);
    const thru = ST.length - ex.length;
    const htOff = ST.filter((r) => { const sp = spOf(r); return Math.abs(sp[0][1] - 45) < 0.05 && !sp.some((s) => s[0] >= 45 - 0.01 && s !== sp[0]); }).length;
    out.push(['When she comes out (as a starter)', ex.length
      ? `Subbed off in the 1st half in <b>${ex.length} of ${ST.length}</b> starts, typically around <b>${m(avg(ex))}</b>${rng(ex)}.${thru ? ` Played through to halftime in ${thru}.` : ''}`
      : `Played through to halftime in all ${ST.length} starts.` + (htOff ? ` Came off at halftime in ${htOff}.` : '')]);
  }

  // bench entry
  if (BE.length) {
    const en = BE.map((r) => spOf(r)[0][0]);
    const e1 = en.filter((x) => x < 45), e2 = en.filter((x) => x >= 45);
    out.push(['When she enters (off the bench)', `${e1.length ? `Comes on in the 1st half in <b>${e1.length}</b> of ${BE.length} bench appearances, around <b>${m(avg(e1))}</b>${rng(e1)}. ` : ''}${e2.length ? `Comes on in the 2nd half in <b>${e2.length}</b> of ${BE.length}, around <b>${m(avg(e2))}</b>${rng(e2)}.` : ''}`]);
  }

  // return + finish
  const END = (r: Rec) => (typeof r.END === 'number' ? r.END : 90);
  const back = P.filter((r) => spOf(r).length > 1 && spOf(r)[0][1] < 45 + 0.01)
    .map((r) => spOf(r).find((s, i) => i > 0 && s[0] >= 45 - 0.01)).filter((s): s is [number, number] => !!s).map((s) => s[0]);
  const lastSp = (r: Rec) => spOf(r)[spOf(r).length - 1];
  const fin = P.filter((r) => lastSp(r)[1] >= END(r) - 0.01).length;
  const lastOff = P.filter((r) => lastSp(r)[1] < END(r) - 0.01).map((r) => lastSp(r)[1]);
  if (back.length || lastOff.length || fin) {
    const atHT = back.filter((x) => x < 45.05).length;
    out.push(['2nd half pattern', `${back.length ? `After coming off in the 1st half, she went back on in <b>${back.length}</b> match${back.length === 1 ? '' : 'es'}${atHT ? ` (${atHT} at the restart)` : ''}${back.length - atHT > 0 ? `, otherwise around ${m(avg(back.filter((x) => x >= 45.05)))}` : ''}. ` : ''}Finished the match in <b>${fin} of ${P.length}</b>${lastOff.length ? `; when she didn't, her last exit came around <b>${m(avg(lastOff))}</b>${rng(lastOff)}` : ''}.`]);
  }

  // spells
  const spl = P.flatMap((r) => spOf(r).map((s) => s[1] - s[0]));
  const nsp = avg(P.map((r) => spOf(r).length)) ?? 0;
  const avgSpl = avg(spl) ?? 0;
  const full = P.filter((r) => spOf(r).length === 1 && spOf(r)[0][0] === 0 && spOf(r)[0][1] >= END(r) - 0.01).length;
  out.push(['Spells', `<b>${nsp.toFixed(1)}</b> spells per match, averaging <b>${m(avgSpl)}</b> each; longest ${m(Math.max(...spl))}.${full ? ` Full 90 in ${full} of ${P.length}.` : ''}${nsp >= 1.8 ? ' She is used in short, repeated bursts.' : nsp <= 1.2 && avgSpl >= 60 ? ' She is used in long, single spells.' : ''}`]);

  // rest / best time to rest
  const playedGames = P.map((r) => r.g as Game).filter(Boolean);
  const rs: Agg[] = (restsOf(playedGames, p) as unknown as Agg[] ?? []).filter((r) => r && typeof r.len === 'number');
  const A = (ppAgg(recs as never) ?? {}) as Agg;
  const bins: number[] | null = Array.isArray(A.bins) && A.bins.length === PPBINS.length ? A.bins : null;
  const lowI = bins ? bins.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])[0][1] : null;
  const lowTxt = lowI != null && P.length >= 3 ? ` She's least often on the field in the ${PPBINS[lowI][0]}–${PPBINS[lowI][1]}' window.` : '';
  if (rs.length === 1) {
    const r = rs[0];
    const rg = r.g as Game | undefined;
    out.push(['Rest', `One 2nd-half breather in this selection: off ${clk(r.off)}, back ${clk(r.on)} (${m(r.len)}), then on for ${m(r.back)}${rg ? ` (${esc(ppD(rg))} ${esc(ppG(rg))})` : ''}. Not enough to call a pattern yet.${lowTxt}`]);
  } else if (rs.length) {
    const offAt = rs.map((r) => r.off as number), len = rs.map((r) => r.len as number), bk = rs.map((r) => r.back as number);
    const aLen = avg(len) ?? 0, aOff = avg(offAt) ?? 0;
    out.push(['Best time to rest her', `${rs.length} 2nd-half breathers, coming around <b>${m(aOff)}</b>${rng(offAt)} and lasting <b>${m(aLen)}</b> on average (${m(Math.min(...len))}–${m(Math.max(...len))}); she's gone back on for about <b>${m(avg(bk))}</b>. ${rs.length >= 3 ? `Pattern to follow: a ~${Math.round(aLen / 5) * 5 || 5}-minute rest starting around ${Math.round(aOff / 5) * 5}' fits how she has been used.` : 'Only a couple of examples so far, so treat this as a lead.'}${lowTxt}`]);
  } else if (bins && lowI != null && P.length >= 3 && avgM >= 30 && bins[lowI] < 0.9) {
    out.push(['Best time to rest her', `No 2nd-half breathers in this selection. She's least often on the field in the <b>${PPBINS[lowI][0]}–${PPBINS[lowI][1]}'</b> window (on ${Math.round(bins[lowI] * 100)}% of it), which is where her minutes are usually managed.`]);
  }

  // environment
  const W = wkInfo(allGames);
  const env = (g: Game) => (envOf(g) ?? {}) as Agg;
  const conds: [string, (r: Rec) => boolean | null, string, string][] = [
    ['venue', (r) => r.g.venue === 'Home', 'home', 'away'],
    ['time', (r) => { const e = env(r.g); return e.night == null ? null : !!e.night; }, 'night', 'early'],
    ['heat', (r) => { const e = env(r.g); return e.heat == null ? null : e.heat < eheat; }, 'cooler', 'hot'],
    ['week', (r) => { const w = W[r.g.id]; return w ? w.n === 1 : null; }, 'single-match weeks', 'two-match weeks'],
  ];
  const effs = conds.map(([, f, a, b]) => {
    const i = P.filter((r) => f(r) === true), o = P.filter((r) => f(r) === false);
    if (i.length < 2 || o.length < 2) return null;
    const ai = avg(i.map((r) => r.min)) ?? 0, ao = avg(o.map((r) => r.min)) ?? 0;
    return { d: ai - ao, a, b, ni: i.length, no: o.length, ai, ao };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const LEAD: Record<string, string> = { home: 'At home', away: 'Away', night: 'At night', early: 'In early kickoffs', cooler: 'In cooler matches', hot: 'In hot matches', 'single-match weeks': 'In single-match weeks', 'two-match weeks': 'In two-match weeks' };
  const VS: Record<string, string> = { home: 'at home', away: 'away', night: 'at night', early: 'in early kickoffs', cooler: 'in cooler matches', hot: 'in hot matches', 'single-match weeks': 'in single-match weeks', 'two-match weeks': 'in two-match weeks' };
  if (effs.length) {
    const e = effs[0]; const more = e.d >= 0; const hi = more ? e.a : e.b, lo = more ? e.b : e.a;
    const e2 = effs[1];
    out.push(['Biggest environment effect', Math.abs(e.d) < 5
      ? `Her minutes are steady across conditions (no venue, kickoff, temperature or week-type gap above 5').`
      : `<b>${LEAD[hi]}</b> she averages ${m(more ? e.ai : e.ao)} per match vs ${m(more ? e.ao : e.ai)} ${VS[lo]} (${more ? e.ni : e.no} vs ${more ? e.no : e.ni} matches), a <b>${m(Math.abs(e.d))}</b> gap.${e2 && Math.abs(e2.d) >= 5 ? ` Next biggest: more ${VS[e2.d >= 0 ? e2.a : e2.b]} (+${m(Math.abs(e2.d))}).` : ''}`]);
  }

  // trend
  if (P.length >= 5) {
    const l3 = P.slice(-3); const d = (avg(l3.map((r) => r.min)) ?? 0) - avgM;
    out.push(['Recent trend', `Last 3 matches played: <b>${l3.map((r) => m(r.min)).join(', ')}</b> (${l3.map((r) => esc(r.g.opp)).join(', ')}), ${Math.abs(d) < 5 ? 'in line with' : d > 0 ? `<b>${m(d)} above</b>` : `<b>${m(-d)} below</b>`} her average for this selection.`]);
  }
  return out;
}

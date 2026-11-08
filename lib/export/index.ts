// Exporters. OWNED BY AGENT C. All return a Blob + filename; UI calls downloadBlob().
// Player names in every display column go through playerLabel() → "#19 - Mary Jane".
// The CSV `player` column is a KEY (last name) and stays raw so it round-trips.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Game, LoadsByGame, Roster } from '@/lib/types';
import { CSV_COLS } from '@/lib/import';
import { RES, buildNameIndex, clk, fullD, halfD, isSEC, minutesRows, playerLabel, sum } from '@/lib/engine';
import type { NameIndex } from '@/lib/engine';

export interface FileOut { filename: string; blob: Blob }

/** Optional naming context: games + roster used to build the name index (defaults to the game(s) exported). */
export interface NameCtx { games?: Game[]; roster?: Roster }

export function downloadBlob({ filename, blob }: FileOut) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const nameIdx = (fallback: Game[], ctx?: NameCtx): NameIndex => buildNameIndex(ctx?.games ?? fallback, ctx?.roster ?? {});
const r1 = (v: number) => Math.round(v * 10) / 10;
const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-');
const fileBase = (g: Game) => `UF-minutes-${g.date}-${safe(g.opp)}`;
const longDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
const htStr = (g: Game) => `HT ${g.ht?.uf ?? 0}–${g.ht?.opp ?? 0}`;

// ---------------------------------------------------------------- CSV (L1466–1474)
/** detail: START/BENCH = first name; GOAL "pk"; SHOT "sog"; CARD "yellow"/"red". Read back by gamesFromTagCsv. */
export function gamesToCsvText(games: Game[]): string {
  const q = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const out = [CSV_COLS.join(',')];
  games.forEach((g) => {
    const base = [g.id, g.date, g.opp, g.venue, g.tier];
    g.lineup.starters.forEach((p) => out.push([...base, '', '', 'UF', 'START', p.name, '', '', p.pos ?? '', p.num ?? '', p.first ?? ''].map(q).join(',')));
    g.lineup.bench.forEach((p) => out.push([...base, '', '', 'UF', 'BENCH', p.name, '', '', p.pos ?? '', p.num ?? '', p.first ?? ''].map(q).join(',')));
    g.events.forEach((e) => {
      const detail = e.type === 'CARD' ? e.card || 'yellow' : e.type === 'GOAL' && e.pk ? 'pk' : e.type === 'SHOT' && e.sog ? 'sog' : '';
      out.push([...base, e.half, e.clock, e.team, e.type, e.player || '', e.on || '', e.off || '', '', '', detail].map(q).join(','));
    });
  });
  return out.join('\n');
}
export function gamesToCsv(games: Game[]): FileOut {
  return { filename: 'gator-sub-board-games.csv', blob: new Blob([gamesToCsvText(games)], { type: 'text/csv' }) };
}

// ---------------------------------------------------------------- JSON (L1520)
const strip = (g: Game): Game => { const c: any = { ...g }; delete c._d; delete c._f; delete c._h; delete c.file; return JSON.parse(JSON.stringify(c)); };
export function boardToJsonText(games: Game[], roster: Roster, loads: LoadsByGame): string {
  return JSON.stringify({ games: games.map(strip), roster, loads }, null, 1);
}
export function boardToJson(games: Game[], roster: Roster, loads: LoadsByGame): FileOut {
  return { filename: 'gator-sub-board.json', blob: new Blob([boardToJsonText(games, roster, loads)], { type: 'application/json' }) };
}

// ---------------------------------------------------------------- minutes rows (L1112)
interface MinRow { p: string; num: string; pos: string; role: string; m1: number; m2: number; full: number; x1: number; x2: number; xf: number; spells: string }
/** Normalize engine minutesRows() (array or {rows,unused}) and compute unused bench. */
function minRows(g: Game, sortFull = false): { rows: MinRow[]; unused: string[] } {
  const mr: any = minutesRows(g);
  const raw: any[] = Array.isArray(mr) ? mr : mr?.rows ?? [];
  const rows: MinRow[] = raw.map((r) => ({
    p: r.p, num: r.num ?? '', pos: r.pos ?? '', role: r.role ?? '',
    m1: +r.m1 || 0, m2: +r.m2 || 0, full: +r.full || 0, x1: +(r.x1 ?? r.m1) || 0, x2: +(r.x2 ?? r.m2) || 0, xf: +(r.xf ?? r.full) || 0, spells: r.spells ?? '',
  }));
  let unused: string[] = Array.isArray(mr) ? [] : mr?.unused ?? [];
  if (Array.isArray(mr)) { const played = new Set(rows.map((r) => r.p)); unused = g.lineup.bench.map((p) => p.name).filter((p) => !played.has(p)); }
  if (sortFull) rows.sort((a, b) => b.full - a.full);
  return { rows, unused };
}

// ---------------------------------------------------------------- XLSX (L1158–1178)
export async function exportXlsx(games: Game[], filename = 'UF-minutes.xlsx', ctx?: NameCtx): Promise<FileOut> {
  const XLSX = await import('xlsx');
  const idx = nameIdx(games, ctx);
  const L = (p: string) => playerLabel(p, idx);
  const wb = XLSX.utils.book_new();
  if (games.length > 1) {
    const all: any[][] = [['Date', 'Opponent', 'Result', 'Venue', 'SEC', '#', 'Player', 'Pos', 'Role', '1st half', '2nd half', 'Full match']];
    games.forEach((g) => minRows(g).rows.forEach((r) => all.push([g.date, g.opp, `${g.result} ${g.gf}-${g.ga}`, g.venue, isSEC(g) ? 'SEC' : '', r.num ? +r.num : '', L(r.p), r.pos, r.role, r.m1, r.m2, r.full])));
    const ws = XLSX.utils.aoa_to_sheet(all);
    ws['!cols'] = [11, 16, 8, 7, 5, 5, 24, 6, 6, 9, 9, 11].map((wch) => ({ wch }));
    ws['!autofilter'] = { ref: `A1:L${all.length}` };
    XLSX.utils.book_append_sheet(wb, ws, 'All matches');
  }
  const used = new Set<string>();
  games.forEach((g, i) => {
    const { rows, unused } = minRows(g);
    const aoa: any[][] = [[`Florida ${g.gf}–${g.ga} ${g.opp}`], [`${g.date} · ${g.venue} · ${g.tier}${isSEC(g) ? ' · SEC' : ''} · ${htStr(g)}`], [],
      ['#', 'Player', 'Pos', 'Role', '1st half', '2nd half', 'Full match', 'On the field'],
      ...rows.map((r) => [r.num ? +r.num : '', L(r.p), r.pos, r.role, r.m1, r.m2, r.full, r.spells]),
      ['', 'Team total', '', '', r1(sum(rows.map((r) => r.x1))), r1(sum(rows.map((r) => r.x2))), r1(sum(rows.map((r) => r.xf))), ''], [],
      [unused.length ? `Did not play: ${unused.map(L).join(', ')}` : ''], ['Minutes rebuilt from the official play-by-play. Halftime 45:00; stoppage not added.']];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [5, 24, 6, 7, 9, 9, 11, 34].map((wch) => ({ wch }));
    let n = `${g.date.slice(5)} ${g.opp}`.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
    while (used.has(n)) n = n.slice(0, 28) + ' ' + i;
    used.add(n);
    XLSX.utils.book_append_sheet(wb, ws, n);
  });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const fn = games.length === 1 && filename === 'UF-minutes.xlsx' ? fileBase(games[0]) + '.xlsx' : filename;
  return { filename: fn, blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
}

// ---------------------------------------------------------------- jsPDF helpers
type RGB = [number, number, number];
async function newDoc() {
  const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const autoTable = (opts: any) => at.default(doc, opts);
  const lastY = () => ((doc as any).lastAutoTable?.finalY as number) ?? 0;
  return { doc, autoTable, lastY };
}
function star(doc: any, cx: number, cy: number, r: number, col: RGB) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.setFillColor(...col); doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'F', true);
}
const pdfOut = (doc: any, filename: string): FileOut => ({ filename, blob: doc.output('blob') as Blob });

// ---------------------------------------------------------------- Minutes PDF (L1294)
export async function exportMinutesPdf(game: Game, ctx?: NameCtx): Promise<FileOut> {
  const g = game; const idx = nameIdx([g], ctx); const L = (p: string) => playerLabel(p, idx);
  const { doc, autoTable, lastY } = await newDoc();
  const { rows, unused } = minRows(g); const W = doc.internal.pageSize.getWidth(), M = 40;
  doc.setFillColor(0, 33, 165); doc.rect(0, 0, W, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(12, 22, 49); doc.text(`Florida ${g.gf}–${g.ga} ${g.opp}`, M, 44);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(89, 98, 127);
  doc.text(`${longDate(g.date)}  ·  ${g.venue}  ·  ${g.tier}${isSEC(g) ? ' · SEC' : ''}  ·  ${htStr(g)}`, M, 62);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(226, 70, 28); doc.text('PLAYER MINUTES', W - M, 44, { align: 'right' });
  const body = rows.map((r) => [L(r.p), r.pos, r.role, r.m1.toFixed(1), r.m2.toFixed(1), r.full.toFixed(1), '']);
  body.push(['Team total', '', '', r1(sum(rows.map((r) => r.x1))).toFixed(1), r1(sum(rows.map((r) => r.x2))).toFixed(1), r1(sum(rows.map((r) => r.xf))).toFixed(1), '']);
  autoTable({
    startY: 78, margin: { left: M, right: M }, head: [['Player', 'Pos', 'Role', '1st half', '2nd half', 'Full', 'Notes / load']], body, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10.5, cellPadding: { top: 5.5, bottom: 5.5, left: 5, right: 5 }, lineColor: [210, 215, 228], lineWidth: 0.6, textColor: [12, 22, 49], valign: 'middle' },
    headStyles: { fillColor: [0, 33, 165], textColor: 255, fontStyle: 'bold', fontSize: 9.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 176, fontStyle: 'bold' }, 1: { halign: 'center', cellWidth: 36 }, 2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'center', cellWidth: 52 }, 4: { halign: 'center', cellWidth: 52 }, 5: { halign: 'center', cellWidth: 48, fontStyle: 'bold', textColor: [0, 33, 165] }, 6: { cellWidth: 'auto' } },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    didParseCell: (d: any) => { if (d.section === 'body' && d.row.index === body.length - 1) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [227, 232, 248]; } },
  });
  let y = lastY() + 16; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(89, 98, 127);
  const notes = [unused.length ? `Did not play: ${unused.map(L).join(', ')}.` : '', 'Minutes rebuilt from the official play-by-play (tenths of a minute). Halftime 45:00; stoppage time not added.', 'Role: Start = in the starting XI; Sub = came off the bench.'].filter(Boolean);
  notes.forEach((n) => { const lines = doc.splitTextToSize(n, W - 2 * M); doc.text(lines, M, y); y += lines.length * 12; });
  doc.setFontSize(8); doc.text(`Gator Sub Board · printed ${new Date().toLocaleDateString('en-US')}`, M, doc.internal.pageSize.getHeight() - 24);
  return pdfOut(doc, fileBase(g) + '.pdf');
}

// ---------------------------------------------------------------- Match report (L1180–1293)
/** `loads` is accepted for future load columns; not used by the original report. */
export async function exportReport(game: Game, loads?: LoadsByGame, ctx?: NameCtx): Promise<FileOut> {
  void loads;
  const g = game; const idx = nameIdx([g], ctx); const L = (p: string) => playerLabel(p, idx);
  const { doc, autoTable, lastY } = await newDoc();
  const W = doc.internal.pageSize.getWidth(), Hp = doc.internal.pageSize.getHeight(), M = 36;
  const F = fullD(g), h1 = halfD(g, 1), h2 = halfD(g, 2); const { rows, unused } = minRows(g, true);
  const BLUE: RGB = [0, 33, 165], ORANGE: RGB = [226, 70, 28], INK: RGB = [12, 22, 49], MUTED: RGB = [89, 98, 127], LINE: RGB = [221, 226, 237], SOFT: RGB = [246, 247, 251], HTC: RGB = [110, 130, 210];
  const isGK = (p: string) => [...g.lineup.starters, ...g.lineup.bench].find((x) => x.name === p)?.pos === 'GK' || ctx?.roster?.[p]?.pos === 'GK';
  doc.setFillColor(...BLUE); doc.rect(0, 0, W, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...INK); doc.text(`Florida ${g.gf}–${g.ga} ${g.opp}`, M, 40);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED);
  doc.text(`${longDate(g.date)}  ·  ${g.venue}  ·  ${g.tier}${isSEC(g) ? ' · SEC' : ''}  ·  ${htStr(g)}  ·  ${RES[g.result]}`, M, 56);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ORANGE); doc.text('MATCH SUB REPORT', W - M, 40, { align: 'right' });
  const f90 = Object.entries(F.spells).filter(([p, sp]) => !isGK(p) && sp.length === 1 && sp[0][0] === 0 && sp[0][1] >= F.END).length;
  const k: [string, string][] = [[clk(h1.first), 'First sub'], [String(h1.subs.length), '1st-half subs'], [String(F.htSubs.length), 'Halftime changes'], [h2.first != null ? clk(h2.first) : '—', 'First 2H in-play sub'], [String(h2.subs.length), '2H in-play subs'], [String(Object.keys(F.spells).length), 'Players used'], [String(f90), 'Outfield full 90s']];
  const gap = 6, bw = (W - 2 * M - gap * (k.length - 1)) / k.length;
  k.forEach(([v, l], i) => {
    const x = M + i * (bw + gap); doc.setFillColor(...SOFT); doc.roundedRect(x, 68, bw, 42, 4, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...INK); doc.text(v, x + 8, 88);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(l, x + 8, 102);
  });
  // subs per 5 minutes + halftime bar + goal stars
  type Col = { ht?: boolean; a: number; n: number; goals: { team: string }[] };
  const cols: Col[] = []; for (let a = 0; a < 90; a += 5) { if (a === 45) cols.push({ ht: true, a: -1, n: F.htSubs.length, goals: [] }); cols.push({ a, n: 0, goals: [] }); }
  const colOf = (m: number) => { const a = Math.min(85, Math.max(0, Math.floor(m / 5) * 5)); return cols.find((c) => !c.ht && c.a === a)!; };
  F.subs.filter((s) => !F.htSubs.includes(s)).forEach((s) => colOf(s.min).n++);
  const goalsEv = g.events.filter((e) => e.type === 'GOAL');
  goalsEv.forEach((e) => colOf(e.t / 60).goals.push(e));
  const cy0 = 124; doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text('WHEN WE SUBBED  ·  subs per 5 minutes', M, cy0);
  const lg: [RGB, string, string][] = [[ORANGE, 'Our subs', 'sq'], [HTC, 'Halftime changes', 'sq'], [BLUE, 'Gator goal', 'star'], [ORANGE, 'Opponent goal', 'star']];
  let lx = W - M; doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  lg.slice().reverse().forEach(([c, l, kind]) => { const tw = doc.getTextWidth(l); lx -= tw; doc.setTextColor(...MUTED); doc.text(l, lx, cy0); lx -= 10; if (kind === 'star') star(doc, lx + 3.5, cy0 - 2.8, 4.5, c); else { doc.setFillColor(...c); doc.rect(lx, cy0 - 6, 7, 7, 'F'); } lx -= 12; });
  const maxN = Math.max(1, ...cols.map((c) => c.n)), maxG = Math.max(0, ...cols.map((c) => c.goals.length));
  const top = cy0 + 14 + maxG * 13, base = cy0 + 170, ph = base - top - 14, cw = (W - 2 * M - 18) / cols.length, x0 = M + 18;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
  const step = maxN <= 6 ? 1 : maxN <= 12 ? 2 : 3; doc.setFontSize(7); doc.setTextColor(...MUTED);
  for (let v = 0; v <= maxN; v += step) { const y = base - ph * (v / maxN); doc.line(x0, y, W - M, y); doc.text(String(v), x0 - 5, y + 2.5, { align: 'right' }); }
  cols.forEach((c, i) => {
    const x = x0 + i * cw + 3, w = cw - 6;
    if (c.ht) { doc.setFillColor(227, 232, 248); doc.rect(x0 + i * cw + 1, top - 4, cw - 2, base - top + 4, 'F'); }
    if (c.n) { const h = ph * (c.n / maxN); doc.setFillColor(...(c.ht ? HTC : ORANGE)); doc.roundedRect(x, base - h, w, h, 2, 2, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...INK); doc.text(String(c.n), x + w / 2, base - h - 3, { align: 'center' }); }
    c.goals.forEach((e, j) => star(doc, x + w / 2, cy0 + 16 + j * 13, 5.5, e.team === 'UF' ? BLUE : ORANGE));
    doc.setFont('helvetica', c.ht ? 'bold' : 'normal'); doc.setFontSize(7); doc.setTextColor(...(c.ht ? BLUE : MUTED)); doc.text(c.ht ? 'HT' : c.a + "'", x + w / 2, base + 10, { align: 'center' });
  });
  // goals + shots line (shots include goals: SHOT + GOAL, as computed by the engine)
  const goals = goalsEv.map((e) => `${e.team === 'UF' ? 'UF' : 'OPP'} ${e.player ? (e.team === 'UF' ? L(e.player) : e.player) : ''} ${e.clock}${e.pk ? ' (PK)' : ''}`);
  let y = base + 26; doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text('Goals:', M, y);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); const gl = doc.splitTextToSize(goals.length ? goals.join('   ·   ') : 'None', W - 2 * M - 36); doc.text(gl, M + 34, y); y += gl.length * 11;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text('Shots:', M, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
  const f1 = h1.first;
  const split = f1 != null ? `before our first sub ${h1.ufShots.filter((t) => t < f1).length}–${h1.oppShots.filter((t) => t < f1).length}, after ${h1.ufShots.filter((t) => t >= f1).length}–${h1.oppShots.filter((t) => t >= f1).length}` : 'before our first sub —, after —';
  doc.text(`1st half ${h1.ufShots.length}–${h1.oppShots.length}   ·   2nd half ${h2.ufShots.length}–${h2.oppShots.length}   ·   ${split} (1st half)`, M + 34, y);
  const body = rows.map((r) => [L(r.p), r.pos, r.role, r.m1.toFixed(1), r.m2.toFixed(1), r.full.toFixed(1), r.spells]);
  body.push(['Team total', '', '', r1(sum(rows.map((r) => r.x1))).toFixed(1), r1(sum(rows.map((r) => r.x2))).toFixed(1), r1(sum(rows.map((r) => r.xf))).toFixed(1), '']);
  const n = body.length, avail = Hp - (y + 14) - 54, rowH = Math.min(18, avail / (n + 1)), fs = rowH >= 16 ? 9 : rowH >= 13 ? 8 : 7, pad = Math.max(1.5, (rowH - fs * 1.15) / 2);
  autoTable({
    startY: y + 12, margin: { left: M, right: M }, head: [['Player', 'Pos', 'Role', '1st half', '2nd half', 'Full', 'On the field']], body, theme: 'grid',
    styles: { font: 'helvetica', fontSize: fs, cellPadding: { top: pad, bottom: pad, left: 4, right: 4 }, lineColor: LINE, lineWidth: 0.5, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold', fontSize: fs - 0.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 140, fontStyle: 'bold' }, 1: { halign: 'center', cellWidth: 30 }, 2: { halign: 'center', cellWidth: 34 }, 3: { halign: 'center', cellWidth: 44 }, 4: { halign: 'center', cellWidth: 44 }, 5: { halign: 'center', cellWidth: 40, fontStyle: 'bold', textColor: BLUE }, 6: { cellWidth: 'auto', fontSize: fs - 1, textColor: MUTED } },
    alternateRowStyles: { fillColor: SOFT },
    didParseCell: (d: any) => { if (d.section === 'body' && d.row.index === n - 1) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [227, 232, 248]; } },
  });
  const fy = lastY() + 12; doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text(`${unused.length ? `Did not play: ${unused.map(L).join(', ')}.  ` : ''}Sorted by full-match minutes. Minutes rebuilt from the official play-by-play; halftime 45:00, stoppage not added.`, M, Math.min(fy, Hp - 40), { maxWidth: W - 2 * M });
  doc.text(`Gator Sub Board · ${new Date().toLocaleDateString('en-US')} · page 1 of 2`, M, Hp - 22);
  // ---------------- page 2: full-match rotation
  doc.addPage(); doc.setFillColor(...BLUE); doc.rect(0, 0, W, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...INK); doc.text(`Florida ${g.gf}–${g.ga} ${g.opp}`, M, 38);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ORANGE); doc.text('WHO WAS ON, WHEN', W - M, 38, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text("Every spell on the field, full match. Blue = started, orange = off the bench. Top rows: our shots and goals, then the opponent's.", M, 53);
  const END2 = F.END || 90, st2 = g.lineup.starters.map((p) => p.name);
  const order = [...st2, ...Object.keys(F.spells).filter((p) => !st2.includes(p)).sort((a, b) => F.spells[a][0][0] - F.spells[b][0][0])].filter((p) => F.spells[p]);
  const lw = 118, rx0 = M + lw, rx1 = W - M - 30, sx = (m: number) => rx0 + (rx1 - rx0) * (Math.min(m, END2) / END2);
  const topY = 70, evH = 34, rows0 = topY + evH + 6; const nR = Math.max(1, order.length);
  const logLines = Math.ceil(h1.subs.length / 2) + Math.ceil(F.htSubs.length / 2) + Math.ceil(h2.subs.length / 2);
  let lineH = 11.5; const reserve = () => 3 * 20 + logLines * lineH + 3 * 8 + 30;
  let rH2 = Math.min(21, (Hp - rows0 - 40 - reserve()) / nR); if (rH2 < 13) { lineH = 10; rH2 = Math.min(21, (Hp - rows0 - 40 - reserve()) / nR); }
  rH2 = Math.max(11, rH2); const bH2 = Math.max(6, rH2 * 0.62);
  const chartBottom = rows0 + order.length * rH2;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.5); doc.setLineDashPattern([], 0);
  for (let m = 0; m <= END2; m += 15) { doc.line(sx(m), topY, sx(m), chartBottom); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(m + "'", sx(m), chartBottom + 11, { align: 'center' }); }
  doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text('Florida', rx0 - 6, topY + 11, { align: 'right' }); doc.text('Opponent', rx0 - 6, topY + 27, { align: 'right' });
  doc.setLineWidth(1.2);
  F.ufShots.forEach((m) => { doc.setDrawColor(120, 140, 215); doc.line(sx(m), topY + 4, sx(m), topY + 14); });
  F.oppShots.forEach((m) => { doc.setDrawColor(160, 166, 184); doc.line(sx(m), topY + 20, sx(m), topY + 30); });
  F.ufGoals.forEach((m) => star(doc, sx(m), topY + 9, 6, BLUE)); F.oppGoals.forEach((m) => star(doc, sx(m), topY + 25, 6, ORANGE));
  doc.setLineWidth(0.5); doc.setDrawColor(...LINE); doc.line(rx0, rows0 - 3, rx1, rows0 - 3);
  order.forEach((p, i) => {
    const yy = rows0 + i * rH2; const isSt = st2.includes(p);
    if (i % 2 === 0) { doc.setFillColor(...SOFT); doc.rect(M, yy, W - 2 * M, rH2, 'F'); }
    doc.setFont('helvetica', isSt ? 'bold' : 'normal'); doc.setFontSize(Math.min(9, rH2 * 0.5)); doc.setTextColor(...INK); doc.text(L(p), rx0 - 6, yy + rH2 / 2 + 3, { align: 'right' });
    F.spells[p].forEach(([a, b]) => { doc.setFillColor(...(isSt ? BLUE : ORANGE)); doc.roundedRect(sx(a), yy + (rH2 - bH2) / 2, Math.max(2, sx(b) - sx(a)), bH2, 2, 2, 'F'); });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(String(Math.round(F.mins[p] ?? 0)), W - M, yy + rH2 / 2 + 3, { align: 'right' });
  });
  doc.setFontSize(7); doc.text('min', W - M, rows0 - 6, { align: 'right' });
  doc.setDrawColor(...ORANGE); doc.setLineWidth(1.2); doc.setLineDashPattern([3, 2], 0); doc.line(sx(45), topY - 2, sx(45), chartBottom); doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...ORANGE); doc.text('HT', sx(45), topY - 4, { align: 'center' });
  let y2 = chartBottom + 26;
  const block = (title: string, items: string[]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(title, M, y2); y2 += 12;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(lineH < 11 ? 7.8 : 8.5); doc.setTextColor(...MUTED);
    if (!items.length) { doc.text('None', M, y2); y2 += 14; return; }
    const colW = (W - 2 * M) / 2, per = Math.ceil(items.length / 2);
    items.forEach((s, i) => doc.text(s, M + (i < per ? 0 : colW), y2 + (i % per) * lineH)); y2 += per * lineH + 8;
  };
  const sc = (tSec: number) => { const s = F.scoreAt(tSec); return `${s.uf}–${s.opp}`; };
  block('1st-half subs', h1.subs.map((s) => `${clk(s.min)}   ${L(s.on)} on for ${L(s.off)}   (${sc(s.t)})`));
  block('Halftime changes', F.htSubs.map((s) => `${L(s.on)} on for ${L(s.off)}`));
  block('2nd-half in-play subs', h2.subs.map((s) => `${clk(s.min)}   ${L(s.on)} on for ${L(s.off)}   (${sc(s.t)})`));
  doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(`Gator Sub Board · ${new Date().toLocaleDateString('en-US')} · page 2 of 2`, M, Hp - 22);
  return pdfOut(doc, `UF-match-report-${g.date}-${safe(g.opp)}.pdf`);
}

// ---------------------------------------------------------------- Strategy sheet (L1984–2017)
const stMin = (v: number | null | undefined) => (v == null ? '—' : Math.abs(v - 45) < 0.05 ? 'HT' : Math.round(v) + "'");
const stFmt = {
  on1: (v: number | null | undefined) => (v == null ? '—' : v < 0.05 ? '0' : Math.round(v) + "'"), off1: stMin, on2: stMin,
  off2: (v: number | null | undefined) => (v == null ? '—' : v >= 89.5 ? 'FT' : Math.round(v) + "'"),
  m1: (v: number) => Math.round(v || 0) + '', m2: (v: number) => Math.round(v || 0) + '', len2: (v: number | null | undefined) => (v == null ? '—' : Math.round(v) + "'"),
  n2: (v: number) => (v || 0).toFixed(1), tot: (v: number) => Math.round(v || 0) + '',
};
/** Strategy sheet. `st` is the result of stStats(): either an array of player rows or `{rows}` (shape owned by the engine). */
export async function stPdf(st: any, label: string, ctx?: NameCtx & { through?: string }): Promise<FileOut> {
  const rows: any[] = Array.isArray(st) ? st : st?.rows ?? Object.values(st ?? {});
  const idx = nameIdx(ctx?.games ?? [], ctx); const L = (r: any) => playerLabel(r.p, idx);
  const { doc, autoTable, lastY } = await newDoc();
  const W = 612, H = 792, M = 22, NAVY: RGB = [0, 33, 165], ORG: RGB = [244, 177, 131], GRY: RGB = [217, 217, 217];
  doc.setFillColor(...NAVY); doc.rect(M, M, W - 2 * M, 26, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text("FLORIDA WOMEN'S SOCCER  ·  GATORS SUBBING STRATEGY", W / 2, M + 17.5, { align: 'center' });
  let y = M + 44; doc.setTextColor(...NAVY); doc.setFontSize(9.5); doc.text('Opponent:', M + 2, y); doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.line(M + 52, y + 1.5, M + 190, y + 1.5);
  doc.text('Date:', M + 202, y); doc.line(M + 230, y + 1.5, M + 310, y + 1.5);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(60); doc.setFontSize(8);
  const bs = `Based on: ${label}${ctx?.through ? ' · through ' + ctx.through : ''}`;
  if (doc.getTextWidth(bs) > W - 2 * M - 320) { y += 13; doc.text(bs, M + 2, y); } else doc.text(bs, W - M - 2, y, { align: 'right' });
  const n = rows.length; const avail = H - M - (y + 10) - 38 - 34; const rowH = Math.max(13, Math.min(22, avail / Math.max(n, 1))); const fs = rowH >= 18 ? 9 : rowH >= 15 ? 8 : 7;
  const body = rows.map((r, i) => [i + 1, L(r), `${r.gp} (${r.gs})`, stFmt.on1(r.on1), stFmt.off1(r.off1), stFmt.m1(r.m1), stFmt.on2(r.on2), stFmt.off2(r.off2), stFmt.m2(r.m2), stFmt.len2(r.len2), stFmt.n2(r.n2), stFmt.tot(r.tot), '']);
  const hs = (fill: RGB, tc: number | RGB = 255) => ({ fillColor: fill, textColor: tc, fontStyle: 'bold', halign: 'center', valign: 'middle' });
  autoTable({
    startY: y + 10, margin: { left: M, right: M }, theme: 'grid', tableWidth: W - 2 * M,
    head: [[{ content: '#', rowSpan: 2, styles: hs(NAVY) }, { content: 'ATHLETE', rowSpan: 2, styles: hs(NAVY) }, { content: 'GP\n(GS)', rowSpan: 2, styles: hs(NAVY) }, { content: '1ST HALF', colSpan: 3, styles: hs(ORG, [40, 40, 40]) }, { content: '2ND HALF', colSpan: 5, styles: hs(GRY, [0, 0, 0]) }, { content: 'MATCH', styles: hs(NAVY) }, { content: 'NOTES', rowSpan: 2, styles: hs([255, 255, 255], [0, 33, 165]) }],
      [{ content: 'Avg on', styles: hs(ORG, [40, 40, 40]) }, { content: 'Avg off', styles: hs(ORG, [40, 40, 40]) }, { content: 'Avg mins', styles: hs(ORG, [40, 40, 40]) }, { content: 'Avg on', styles: hs(GRY, [0, 0, 0]) }, { content: 'Avg off\n1st spell', styles: hs(GRY, [0, 0, 0]) }, { content: 'Avg mins', styles: hs(GRY, [0, 0, 0]) }, { content: 'Spell length', styles: hs(GRY, [0, 0, 0]) }, { content: 'Avg spells', styles: hs(GRY, [0, 0, 0]) }, { content: 'Avg total mins', styles: hs(NAVY) }]],
    body, styles: { font: 'helvetica', fontSize: fs, cellPadding: { top: 1, bottom: 1, left: 3, right: 3 }, minCellHeight: rowH, valign: 'middle', halign: 'center', lineColor: [170, 176, 196], lineWidth: 0.5, textColor: [20, 20, 20] },
    headStyles: { fontSize: 7.5, lineColor: [170, 176, 196], lineWidth: 0.5, minCellHeight: 14 },
    columnStyles: { 0: { cellWidth: 16, textColor: [110, 110, 110] }, 1: { cellWidth: 114, halign: 'left' }, 2: { cellWidth: 35 }, 3: { cellWidth: 34 }, 4: { cellWidth: 34 }, 5: { cellWidth: 36 }, 6: { cellWidth: 34 }, 7: { cellWidth: 40 }, 8: { cellWidth: 36 }, 9: { cellWidth: 37 }, 10: { cellWidth: 35 }, 11: { cellWidth: 46 }, 12: { cellWidth: 'auto' } },
    didParseCell: (d: any) => {
      if (d.section !== 'body') return; const c = d.column.index, r = rows[d.row.index];
      if (c >= 3 && c <= 5) d.cell.styles.fillColor = [252, 236, 224]; else if (c >= 6 && c <= 10) d.cell.styles.fillColor = [242, 242, 242];
      else if (c === 11) { d.cell.styles.fillColor = [226, 239, 218]; d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = [0, 33, 165]; d.cell.styles.fontSize = fs + 1; }
      else if (c <= 2 && r && r.gs === 0) d.cell.styles.fillColor = [244, 246, 251];
      if (c === 1 || c === 5 || c === 8) d.cell.styles.fontStyle = 'bold';
    },
  });
  const fy = lastY() + 10; doc.setFontSize(6.6); doc.setTextColor(90); doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize('Averages per match played. On: starters = 0. HT = through halftime (1st-half off) or on at the restart (2nd-half on). 1st-half on/off use only matches she played in that half. 2nd-half off = end of her first 2nd-half spell (FT = played to the final whistle). 2nd half counts re-subs, so a player who goes off and comes back has 2 spells. Avg mins: 1st half + 2nd half = avg total. Minutes from the official play-by-play; stoppage time not added. GP = matches played, GS = starts.', W - 2 * M), M, Math.min(fy, H - M - 16));
  return pdfOut(doc, `UF-subbing-strategy-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

// ---------------------------------------------------------------- Environment ranking (L1772)
/** `meta.t` = [title, word, _, conditionLabel, oppositeLabel] as in the original ENVRANK.t; nA/nB = match counts. */
export async function envRankPdf(rows: any[], label: string, meta?: { t?: string[]; nA?: number; nB?: number; through?: string } & NameCtx): Promise<FileOut> {
  const t = meta?.t ?? ['Environment ranking', 'minutes', '', 'Condition', 'Opposite'];
  const idx = nameIdx(meta?.games ?? [], meta);
  const { doc } = await newDoc();
  const W = 612, H = 792, M = 28, NAVY: RGB = [0, 33, 165], ORG: RGB = [226, 70, 28], BLU: RGB = [47, 85, 212];
  doc.setFillColor(...NAVY); doc.rect(M, M, W - 2 * M, 28, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(`FLORIDA WOMEN'S SOCCER  ·  ${t[0].toUpperCase()}`, W / 2, M + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
  doc.text(`${label} · ${meta?.nB ?? '?'} ${t[3].toLowerCase()} vs ${meta?.nA ?? '?'} ${t[4].toLowerCase()}${meta?.through ? ' · through ' + meta.through : ''}`, M, M + 44);
  doc.text(`Minutes per match played. Ranked from most extra minutes ${t[1]} to fewest.`, M, M + 56);
  const n = rows.length; const top = M + 74, avail = H - M - 30 - top; const rh = Math.max(13, Math.min(20, avail / (n + 1))); const fs = rh >= 17 ? 9.5 : 8.5;
  const cx = { rk: M + 4, nm: M + 22, a: M + 182, b: M + 246, bar0: M + 292, bar1: W - M - 52, d: W - M - 6 }; const mid = (cx.bar0 + cx.bar1) / 2, half = (cx.bar1 - cx.bar0) / 2; const mx = Math.max(10, ...rows.map((r) => Math.abs(r.d)));
  doc.setFillColor(242, 242, 242); doc.rect(M, top, W - 2 * M, rh, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(40);
  const hy = top + rh / 2 + 3; doc.text('#', cx.rk, hy); doc.text('PLAYER', cx.nm, hy); doc.text(t[4].toUpperCase(), cx.a, hy, { align: 'center' }); doc.text(t[3].toUpperCase(), cx.b, hy, { align: 'center' });
  doc.setTextColor(...BLU); doc.text(`< less ${t[1]}`, mid - 6, hy, { align: 'right' }); doc.setTextColor(...ORG); doc.text(`more ${t[1]} >`, mid + 6, hy); doc.setTextColor(40); doc.text('DIFF', cx.d, hy, { align: 'right' });
  rows.forEach((r, i) => {
    const y = top + rh * (i + 1); if (i % 2 === 0) { doc.setFillColor(248, 249, 252); doc.rect(M, y, W - 2 * M, rh, 'F'); }
    const ty = y + rh / 2 + 3; doc.setTextColor(r.thin ? 150 : 20); doc.setFont('helvetica', 'normal'); doc.setFontSize(fs - 1); doc.text(String(i + 1), cx.rk, ty);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.text(`${playerLabel(r.p, idx)}${r.gk ? ' (GK)' : ''}${r.thin ? ' *' : ''}`, cx.nm, ty);
    doc.setFont('helvetica', 'normal'); doc.text(`${Math.round(r.a)}'`, cx.a, ty, { align: 'center' }); doc.text(`${Math.round(r.b)}'`, cx.b, ty, { align: 'center' });
    const w = Math.min(1, Math.abs(r.d) / mx) * half; const bh = Math.max(5, rh * 0.5);
    if (r.d >= 0) { doc.setFillColor(...((r.thin ? [240, 170, 150] : ORG) as RGB)); doc.rect(mid, y + (rh - bh) / 2, w, bh, 'F'); } else { doc.setFillColor(...((r.thin ? [160, 180, 235] : BLU) as RGB)); doc.rect(mid - w, y + (rh - bh) / 2, w, bh, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...((r.thin ? [150, 150, 150] : r.d >= 3 ? ORG : r.d <= -3 ? BLU : [60, 60, 60]) as RGB)); doc.text(`${r.d > 0.5 ? '+' : r.d < -0.5 ? '-' : ''}${Math.abs(Math.round(r.d))}'`, cx.d, ty, { align: 'right' });
  });
  doc.setDrawColor(120); doc.setLineWidth(0.6); doc.line(mid, top + rh, mid, top + rh * (n + 1));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90);
  doc.text(doc.splitTextToSize(`Diff = ${t[3].toLowerCase()} minus ${t[4].toLowerCase()} minutes per match played. * = fewer than 2 matches on one side (read with care). Only players who played in both types of match are listed. Minutes rebuilt from the official play-by-play.`, W - 2 * M), M, Math.min(top + rh * (n + 1) + 16, H - M - 12));
  return pdfOut(doc, `UF-${t[0].toLowerCase().replace(/[^a-z]+/g, '-')}-${label.split(' · ')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

// ---------------------------------------------------------------- Scenario (L2337)
/** `scn` is the scnCompute() result: {rows, sel: [key,value][], direct: Game[], games?}; `scn.words?.[key]?.[value]` labels a column. */
export async function scnPdf(scn: any, label: string, ctx?: NameCtx & { through?: string; selLabel?: string }): Promise<FileOut> {
  const rows: any[] = scn?.rows ?? []; const sel: [string, string][] = scn?.sel ?? []; const direct: Game[] = scn?.direct ?? [];
  const idx = nameIdx(ctx?.games ?? scn?.games ?? [], ctx);
  const { doc } = await newDoc();
  const W = 612, H = 792, M = 28, NAVY: RGB = [0, 33, 165], ORG: RGB = [226, 70, 28], BLU: RGB = [47, 85, 212];
  doc.setFillColor(...NAVY); doc.rect(M, M, W - 2 * M, 28, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5);
  doc.text(`FLORIDA WOMEN'S SOCCER  ·  SCENARIO: ${label.toUpperCase()}`, W / 2, M + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
  doc.text(`${ctx?.selLabel ? ctx.selLabel + ' · ' : ''}${ctx?.through ? 'through ' + ctx.through + ' · ' : ''}${direct.length} past match${direct.length === 1 ? '' : 'es'} with exactly this scenario${direct.length ? ': ' + direct.map((g) => g.opp).join(', ') : ''}`, M, M + 44, { maxWidth: W - 2 * M });
  doc.text("Environment Impact = sum of each condition's effect (minutes per match played in that condition minus the opposite). Ranked highest first.", M, M + 56);
  const k = sel.length; const n = rows.length; const top = M + 72, avail = H - M - 34 - top; const rh = Math.max(12, Math.min(20, avail / (n + 1))); const fs = rh >= 17 ? 9 : 8;
  const effW = 46; const x0 = M + 20 + 130; const sc = W - M - 108, bar1 = sc - 52;
  const cx = { rk: M + 4, nm: M + 20, eff: (i: number) => x0 + effW * i + effW / 2, bar0: x0 + effW * k + 6, dx: W - M - 6, sc, bar1 };
  const mid = (cx.bar0 + cx.bar1) / 2, half = (cx.bar1 - cx.bar0) / 2; const mx = Math.max(10, ...rows.map((r) => Math.abs(r.score)));
  doc.setFillColor(242, 242, 242); doc.rect(M, top, W - 2 * M, rh, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(40); const hy = top + rh / 2 + 3;
  doc.text('#', cx.rk, hy); doc.text('PLAYER', cx.nm, hy); sel.forEach(([kk, v], i) => doc.text(String(scn?.words?.[kk]?.[v] ?? v).toUpperCase(), cx.eff(i), hy, { align: 'center' }));
  doc.setTextColor(...BLU); doc.text('< less', mid - 4, hy, { align: 'right' }); doc.setTextColor(...ORG); doc.text('more >', mid + 4, hy); doc.setTextColor(40); doc.text('ENV. IMPACT', cx.sc, hy, { align: 'right' }); doc.text('EXACT SCENARIO', cx.dx, hy, { align: 'right' });
  const s = (v: number) => `${v > 0.5 ? '+' : v < -0.5 ? '-' : ''}${Math.abs(Math.round(v))}'`;
  const tone = (v: number, gray: boolean): RGB => (gray ? [150, 150, 150] : v >= 3 ? ORG : v <= -3 ? BLU : [60, 60, 60]);
  rows.forEach((r, i) => {
    const y = top + rh * (i + 1); if (i % 2 === 0) { doc.setFillColor(248, 249, 252); doc.rect(M, y, W - 2 * M, rh, 'F'); } const ty = y + rh / 2 + 3; const gray = !!r.thin;
    doc.setTextColor(gray ? 150 : 20); doc.setFont('helvetica', 'normal'); doc.setFontSize(fs - 1); doc.text(String(i + 1), cx.rk, ty);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.text(`${playerLabel(r.p, idx)}${r.gk ? ' (GK)' : ''}${r.thin ? ' *' : ''}`, cx.nm, ty);
    doc.setFont('helvetica', 'normal'); sel.forEach(([kk], j) => { const d = r.eff?.[kk]?.d ?? 0; doc.setTextColor(...tone(d, gray)); doc.text(s(d), cx.eff(j), ty, { align: 'center' }); });
    const w = Math.min(1, Math.abs(r.score) / mx) * half, bh = Math.max(5, rh * 0.5);
    if (r.score >= 0) { doc.setFillColor(...((gray ? [240, 170, 150] : ORG) as RGB)); doc.rect(mid, y + (rh - bh) / 2, w, bh, 'F'); } else { doc.setFillColor(...((gray ? [160, 180, 235] : BLU) as RGB)); doc.rect(mid - w, y + (rh - bh) / 2, w, bh, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...tone(r.score, gray)); doc.text(s(r.score), cx.sc, ty, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(gray ? 150 : 40); doc.text(r.dN ? `${Math.round(r.dAvg)}' (${r.dN}) ${s(r.dDelta)}` : '-', cx.dx, ty, { align: 'right' });
  });
  doc.setDrawColor(120); doc.setLineWidth(0.6); doc.line(mid, top + rh, mid, top + rh * (n + 1));
  doc.setFontSize(7); doc.setTextColor(90); doc.text(doc.splitTextToSize('Each condition column = minutes per match played in that condition minus the opposite. Exact scenario = her average in past matches that had every selected condition (matches) and how that compares with her season average. * = fewer than 2 matches on one side of a condition. Environment Impact ranks players; it is not a minutes forecast. Conditions can overlap, so use the exact-scenario column as the reality check.', W - 2 * M), M, Math.min(top + rh * (n + 1) + 14, H - M - 14));
  return pdfOut(doc, `UF-scenario-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}

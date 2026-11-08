// GET /api/ncaa?date=YYYY-MM-DD           → Florida games that day (from ncaa.com)
// GET /api/ncaa?gameId=6667166[&date=...]  → parsed Game for review (not saved) + warnings + confidence
// Signed-in users only. Upstream responses are cached server-side (see lib/import/ncaaFetch.ts).
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUserId } from '@/lib/import/ncaaAuth';
import { floridaContests, ncaaToGame } from '@/lib/import/ncaaCom';
import { NcaaUpstreamError, fetchContests, fetchGame } from '@/lib/import/ncaaFetch';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^\d{4,10}$/;

export async function GET(req: NextRequest) {
  if (!(await getSessionUserId())) return json({ error: 'Not signed in' }, 401);
  const sp = req.nextUrl.searchParams;
  const date = sp.get('date');
  const gameId = sp.get('gameId');
  if (date && !DATE_RE.test(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400);
  if (gameId && !ID_RE.test(gameId)) return json({ error: 'gameId must be a numeric ncaa.com contest id' }, 400);
  if (!date && !gameId) return json({ error: 'Pass ?date=YYYY-MM-DD or ?gameId=<ncaa.com contest id>' }, 400);

  try {
    if (!gameId) {
      const games = floridaContests(await fetchContests(date as string));
      return json({ date, games });
    }
    // Contest metadata (date, live state, opponent conference) comes from the day's scoreboard.
    const contest = date ? floridaContests(await fetchContests(date)).find((c) => c.contestId === gameId) : undefined;
    const live = contest ? !contest.final : true;
    const { pbp, box } = await fetchGame(gameId, live);
    if (!pbp.data?.playbyplay && !box.data?.boxscore) return json({ error: 'No data for this contest yet', contest: contest ?? null }, 404);
    const parsed = ncaaToGame(pbp, box, { date: contest?.date ?? date ?? undefined, oppConf: contest?.oppConf, venue: contest?.venue });
    const isLive = contest ? contest.live : parsed.confidence.live;
    return json({
      ...parsed,
      contest: contest ?? null,
      live: isLive,
      // Client polls every 60s only while live; stop when final.
      pollMs: isLive ? 60_000 : null,
    });
  } catch (e) {
    if (e instanceof NcaaUpstreamError) {
      return json({ error: e.message, upstreamStatus: e.status }, e.status === 429 ? 503 : 502);
    }
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (/Florida is not in this contest/.test(msg)) return json({ error: msg }, 422);
    return json({ error: msg }, 500);
  }
}

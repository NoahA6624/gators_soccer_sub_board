# Gator Sub Board v2: handoff

_Snapshot 2026-11-08, evening (before Florida @ Arkansas, 8:00 PM CT, NCAA contest 6667166)._

## Where things stand
- **Repo:** https://github.com/NoahA6624/gators_soccer_sub_board (moved from UF-Soccer-Analytics; the old URL redirects). Default branch `main`. All work goes through PRs into `dev`, and `dev` is promoted to `main` at each milestone. Branch protection is off, as decided.
- **`dev`:** has the scaffold, the repo hygiene setup (gitignore, secret scan, pre-commit hook, CI) and a `.gitignore` fix. **No feature PRs are merged yet.**
- **Supabase** (project `subase-gators-sub-board-backend`, ref `gwfonbgluksadbpkbbfg`):
  - The migration `supabase/migrations/20261108000000_init.sql` is **applied**.
  - CLI note: this CLI version targets a local database by default. Use `npx supabase db push --remote`.
- **Local env:** `.env.local` holds the Supabase URL, anon key and service-role key, plus `VERCEL_OIDC_TOKEN`. It is gitignored. Never commit it.
- **Vercel** (project `noaha6624/gators-soccer-sub-board`, linked in `.vercel/`):
  - The Supabase env vars are **not yet set**. The plan is the Supabase→Vercel integration: Supabase dashboard → Project Settings → Integrations → Vercel → connect. That sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
  - Then check with `npx vercel env ls` (names only).
- **Supabase Auth:** still to configure under Authentication → URL Configuration:
  - Site URL: the Vercel production URL.
  - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<app>.vercel.app/auth/callback`, and a wildcard for previews.
  - Confirm the Email provider is enabled.
- **Editors:** none yet. Run `npx tsx scripts/add-editor.ts <email>` once PR #3 is merged.

## Open PRs (all into `dev`)
Merge in this order, rebasing and re-running `npm run check && npm run build` between merges. Expect conflicts in `package-lock.json` (regenerate it with `npm install`).

| Order | PR | Branch | What | Review status at snapshot |
|---|---|---|---|---|
| 1 | #3 | feat/data-auth | Supabase clients, middleware (login required), magic-link login, realtime `BoardProvider`, mutations, seed/add-editor scripts | Reviewer was fixing middleware to fail closed in production when env is missing |
| 2 | #8 | feat/engine | Engine port (fullD/halfD/aggregates/env/strategy/profile/scenario/bench), 5 bug fixes with tests | Reviewer was verifying the math against the original and adding adversarial tests |
| 3 | #6 | feat/import-export | PDF (pdf.js), CSV, JSON and GPS import; CSV, JSON, XLSX and jsPDF exports | **READY.** Sub on/off orientation matches the original ("X for Y" means on=X, off=Y). The reviewer added a CSV/XLSX formula-injection guard in 3483cb7. Nits: the StatCrew Format A parser has no test, and unknown venues default to Away |
| 4 | #2 | feat/weather | Open-Meteo `/api/weather` with Supabase cache, `WeatherButton`, venues incl. Fayetteville | **READY.** The reviewer fixed 3 blockers in c11aa87: the auth skip now applies only when `NODE_ENV==='development'`; fetch errors no longer leak the apikey in a 502; empty results are no longer cached forever. Nits are in the PR comment |
| 5 | #4 | feat/ui-team-players | Team + Players tabs, shared `components/ui/**` | **READY.** The reviewer fixed an XSS issue in d3f6c35: `safeHtml()` in `components/ui/util.ts` keeps only `<b>` and `<br>`, and `relabel`/`Tip` go through it. Nits are in the PR comment (mobile tip `onClick` order, memoise `posFor`) |
| 6 | #5 | feat/ui-games-profile | Games tab (sub timeline, the priority for tonight) + Player Profile | In review |
| 7 | #1 | feat/ui-strategy-bench | Sub Strategy (printable sheet + PDF) + Bench | **READY.** Reviewed, no blockers. Nits are in the PR comment, including removing the try/catch engine guards after #8 and checking that `/games?id=` deep links work |
| 8 | #7 | feat/ui-env-import | Add data (NCAA paste, PDF, CSV, GPS, roster num/first) + Environment | Reviewer was rewriting `components/env/envEngine.ts` to match the real engine API from #8 |
| 9 | #9 | feat/ncaa | NCAA: paste-HTML parser (`parseNcaaHtml`), ncaa.com feed parser, cached `/api/ncaa` route, `useNcaaLiveGame` 60s live polling hook, `ncaaId` on Game | **Not reviewed yet.** Merge after #6, since it appends `export * from './ncaaHtml'` to `lib/import/index.ts` and that line will conflict. Then the Add data UI (#7) must show `warnings` + `confidence` |

Reviewer agents ran in temp clones and were told **not to merge**. Check each PR's latest commits and review comments before merging; some reviews may not have been posted when we powered down.

## Known integration risks to check after merging
1. **Engine API vs UI call sites:**
   - The UI agents coded against stubs. The engine (#8) keeps the original property names, and `SubRec` has both `m` and `min`.
   - `minutesRows` returns `{rows, unused, END}`.
   - Per-game variants are `benchOfGame` and `restsOfGame`.
   - Environment signatures changed: `envPlayers(games, factor, opts)` (single-group version is `envPlayersAB`), `envTeam` returns `{A, B}`, `envRankRows(games, {factor})`, `scnCompute(games, sel, opts)`, `chkRun(games, {gameId, egrp, eres, inc, data, eheat})`.
   - Once everything is merged, click through every tab with real data.
2. **Shot counting:** "shots include goals". The importer emits exactly one GOAL and no SHOT per goal, so the engine must count shots as SHOT + GOAL.
3. **Middleware:** without Supabase env it lets requests through in development only. Production must fail closed.
4. **Weather:** the paid `OPEN_METEO_API_KEY`, if ever set, goes in the server→Open-Meteo URL as `&apikey=` (their auth scheme). It is never logged or returned. The free tier is used now, non-commercial, with the CC BY attribution in the footer.

## NCAA data (research findings)
- **stats.ncaa.org:** returns 403 behind Akamai. **We do not bypass bot protection.** The fallback is staff pasting the play-by-play/box score HTML into Add data.
- **ncaa.com:** the `sdataprod.ncaa.com` GraphQL persisted queries are openly fetchable with an honest UA (`GatorSubBoard/1.0`):
  - `GetContests_web` (sportCode `WSO`, contestDate `MM/DD/YYYY`) lists games.
  - `NCAA_GetGamecenterBoxscoreSoccerById_web` is reliable: starters, number, position, minutes, shots, goals, assists.
  - `NCAA_GetGamecenterPbpGenericById_web` gives play-by-play with clock `mm:ss:ff` (2H starts at 45:00). **Subs are single "Sub in First Last" lines with one name, and that name is sometimes the player going off.** Infer on/off from the on-field state seeded by the box-score starters, pair names that share a clock, and validate against box minutes (warn when a player is off by more than 2 minutes).
  - Persisted-query hashes can rotate, so they're overridable via env.
  - The old `data.ncaa.com/casablanca` feed is stale or 404.
- **Built in PR #9:**
  - The server caches responses: 45s while live, 10 min when final.
  - It backs off for 5 min on 4xx/429/5xx.
  - The client polls every 60s while the game is live only.
- **Accuracy warning:** on a real finished game (11/01 vs Georgia), feed-inferred subs left 6 of 17 Florida players more than 2 minutes off their box-score minutes, so confidence was "low".
  - **Treat feed subs as a draft that staff review.**
  - The pasted stats.ncaa.org HTML is the reliable route.

## Product decisions made
- Next.js 15 App Router + TypeScript, Supabase (Postgres + Auth + Realtime), Vercel. No Tailwind: the original CSS is copied verbatim into `app/globals.css`.
- **Login required for everything** (magic link). Editors (`profiles.role='editor'`, via `editor_allowlist`) see Add data.
- **Player display format everywhere: `#19 - Mary Jane`**, via `playerLabel(last, buildNameIndex(games, roster))` in `lib/engine/names.ts`. Internal keys stay last names. The roster editor can set `num`/`first` when box scores lack them.
- Open-Meteo is used under the free, non-commercial terms.
- Original board for reference: `reference/gator-sub-board.html` (line numbers are cited throughout the PRs) and `reference/build-a-sub-board.md`.

## Still to do (in order)
1. Finish the Supabase→Vercel integration and the Auth URL config (needs you, in the dashboards).
2. Review #9, then merge PRs #3 → #8 → #6 → #9 → #2 → #4 → #5 → #1 → #7.
3. `npm run dev` locally against the real Supabase. Log in, add yourself as editor, import a test game, and click through all 8 tabs.
4. Deploy a Vercel preview from `dev` and run the smoke test: login, every tab, PDF/CSV import, weather auto-fill, a realtime update showing in a second tab.
5. Promote `dev` to `main` and deploy production after your review.
6. Follow-ups:
   - improve feed sub inference accuracy (or fall back to staff review)
   - seed the old board's data via `npx tsx scripts/seed.ts <path outside repo>/export.json` (the old HTML has no embedded data; use its "Download all data (JSON)" export)
   - the Arkansas Sub Board accuracy review (waiting on the file or link)
   - Games-tab rotation/timeline charts (not ported yet)
   - weather backfill script

## Resuming
- Start a new Claude Code session in this folder and point it at this file.
- Agent worktrees from this session live under `.claude/worktrees/` (gitignored). Everything in them is committed and pushed, so they can be removed with `git worktree prune` after the branches merge.
- Repo practices are enforced (see `CLAUDE.md`):
  - `npm run check` = secret scan + tsc + eslint + vitest
  - CI also runs `npm run build`
  - never commit `.env*`, `.claude/` or team data

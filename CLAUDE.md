# Gator Sub Board v2 — agent conventions

Next.js 15 App Router + TypeScript + Supabase + Vercel. Port of `reference/gator-sub-board.html` (the original single-file artifact; cite its line numbers). Guide: `reference/build-a-sub-board.md`.

## Rules
- Branch from `dev`, PR into `dev`. Never push to `main`. Squash merges.
- Touch ONLY the paths your workstream owns. Need something from another module? Use its exported API; if missing, add a local helper in your own dir and note it in the PR.
- `npm run check` (tsc + eslint + vitest) must pass before opening a PR.
- Styling: reuse the original class names in `app/globals.css` (copied verbatim). No Tailwind. Colors only via CSS tokens.
- Data: read via `useBoard()` (`lib/data/board.tsx`); write via `lib/data/mutations.ts`. Never call Supabase from UI components.
- Engine: import from `@/lib/engine`. Pure functions, no DOM. Cache derived data in WeakMaps, never on the game object.
- **Player names: always render via `playerLabel(last, idx)` with `idx = buildNameIndex(games, roster)` → `#19 - Mary Jane`.** Never print a raw last name. Internal keys remain last names.
- Tooltips/charts: port the original SVG helpers (strip, occStrip, laneSVG) as React components in your own components dir.
- Secrets live in `.env.local` (never commit). See `.env.example`.

## Ownership map
- A engine: `lib/engine/**` · B data/auth: `lib/data/**`, `app/(auth)/**`, `middleware.ts`, `lib/supabase/**`, `supabase/**`
- C import/export: `lib/import/**` (except ncaa*), `lib/export/**` · D weather: `lib/weather/**`, `app/api/weather/**`
- E NCAA: `lib/import/ncaa*`, `app/api/ncaa/**` · F `app/(board)/{team,players}`, `components/team/**`
- G `app/(board)/{games,profile}`, `components/games/**` · H `app/(board)/{strategy,bench}`, `components/strategy/**`
- I `app/(board)/{env,import}`, `components/env/**`, `components/import/**` · shell/layout: lead session only

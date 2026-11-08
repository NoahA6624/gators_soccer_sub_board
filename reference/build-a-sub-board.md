# Building a Sub Board for Another Team

A guide to recreating the Gator Sub Board — a substitution-pattern dashboard for a college soccer team — for a different program. It covers what the board does, how its data is shaped, how it is built, and the order to build it in.

---

## 1. What the board does

The board turns a season of box scores into answers to coaching questions about substitutions: who comes off when, who comes on, how long bench players last, and whether the team plays better or worse after changes.

It has eight tabs:

| Tab | What it answers |
|---|---|
| **Team** | Season KPIs (record, subs per game, typical first-sub minute), filterable by venue, opponent tier and half, with a few auto-written insights. |
| **Players** | Sortable table of every player: starts, bench appearances, minutes, average entry/exit minute, and a per-game strip chart. |
| **Player Profile** | One player in depth: their spells across the season and how they compare to the role average. |
| **Games** | Pick a game, see the score, then every substitution moment in order (clock, who off, who on, game state at the time). |
| **Sub Strategy** | The typical pattern as a plan: when the first wave usually comes, who usually comes on for whom, and a printable PDF. |
| **Bench** | Starters vs. bench players side by side: shots, goals and (when GPS is loaded) running output per minute. |
| **Environment** | How patterns shift by condition (home/away, opponent tier, winning/losing), plus a scenario builder. |
| **Add data** | Import games and GPS, fix positions, export everything as CSV or JSON. |

## 2. Data model

Everything lives in three places. Keep these shapes and most of the UI ports to a new team untouched.

**`games/{gameId}`** — one document per match:

- `id`, `date` (ISO `YYYY-MM-DD`), `opp`, `venue` (Home / Away / Neutral), `tier` (e.g. P4, SEC, non-conference), optional `stage: "Postseason"`
- `score` for both sides and the result (W / L / T)
- `lineup.starters` and `lineup.bench` — arrays of `{name, pos, num}`
- `events` — every substitution, goal, shot, card and corner, each with `half`, `clock` (mm:ss match time), `team` (us / opponent) and the players involved (`player_on`, `player_off` for subs)

**`loads/{gameId}`** — optional GPS rows per game and half (distance, high-speed running, sprint distance, accels/decels), matched to players by last name.

**`meta/roster`** — `{players: {Name: {pos}}}`, used to fill or correct positions the box score leaves blank.

The flat CSV interchange format (used for both import and export) has one row per lineup entry or event:

```
game_id,date,opponent,venue,tier,half,clock,team,type,player,player_on,player_off,pos,num,detail
,2026-10-02,Georgia,Home,P4,,,UF,START,Barnes,,,DEF,33,
,2026-10-02,Georgia,Home,P4,,,UF,BENCH,Sindelar,,,MID,17,
,2026-10-02,Georgia,Home,P4,1,18:40,UF,SUB,,Sindelar,Hess,,,
,2026-10-02,Georgia,Home,P4,1,22:05,UF,GOAL,Taylor,,,,,
```

`type` is one of START, BENCH, SUB, GOAL, SHOT, CARD, CORNER.

## 3. Minute-counting rules

These rules make the numbers trustworthy, so write them down and show them on the page (the board puts them in its footer):

- **1st half:** no re-entry within the half; a player still on at halftime counts as 45'.
- **2nd half:** the "starters" are whoever is on at the restart, after halftime changes. "In-play subs" exclude halftime changes.
- **Full match:** rebuild each player's spells from every sub, including re-entry. The "minutes into a spell" clock starts at entry or at a restart.
- Shots include goals.
- Opponent tier comes from a lookup (e.g. conference opponents) unless overridden at import.

Check your league's substitution rules first. NCAA women's soccer allows re-entry in the second half; a league without re-entry needs simpler spell logic.

## 4. Getting data in

Offer three routes, all ending in the same game document:

1. **Box score PDFs.** Load PDF.js from cdnjs, extract text page by page, and parse the lineup table and play-by-play into the game shape. This is the fiddliest part: box score layouts differ by stats provider, so write one parser per layout (the Gator board has two) and pick by sniffing a header line. Show the parsed game for review before saving it.
2. **Tagged CSV.** For games without a usable PDF or for your own video tagging, accept the CSV format above.
3. **GPS CSV** (e.g. STATSports), one half at a time, matched to players by last name, with a small manual-match table for names that don't line up.

Always include **Export** (all games as CSV, everything as JSON) so the data is never trapped in the page.

## 5. Build it as a Claude artifact

The Gator board is a single self-contained HTML page published as a Claude artifact, using two runtime capabilities:

- **`db`** — the shared database holding `games`, `loads` and `meta/roster`. The page subscribes with `onSnapshot`, so everyone with access sees new games instantly.
- **`user`** — to check `canEdit()`, so only editors see the Add data tab.
- **`downloads`** — to save CSV, JSON and PDF exports.

To start one for another team, ask Claude something like:

> Build a substitution-pattern board for [Team] women's soccer as an artifact with a shared database. Collections: games, loads, meta/roster (shapes below). Tabs: Team, Players, Player Profile, Games, Sub Strategy, Bench, Environment, Add data. Import from box score PDFs (parse in the browser with PDF.js), tagged CSV and STATSports GPS CSV. Use the minute-counting rules below. Colors: [team colors].

Then paste sections 2 and 3 of this guide.

**Sharing note:** artifacts shared across organizations may not let invited editors read the data from Claude directly. Keep the board in the organization that owns the data, or rely on the JSON export.

## 6. Re-skinning for a new team

- **Colors:** all colors are CSS tokens on `:root` (`--blue`, `--orange`, plus win/loss/tie and bench colors), redefined for dark mode. Swap the two brand tokens and check contrast in both themes.
- **Name and copy:** title, header, the subtitle line ("UF Women's Soccer · N games through …"), and the "UF" team code in CSV parsing and PDF filenames.
- **Opponent tiers:** replace the SEC/P4 lookup with your conference.
- **Fonts:** Barlow Condensed (display) and Source Sans 3 (body) from Google Fonts; any condensed display face works.

## 7. Suggested build order

1. Data model and the CSV import/export, with two or three hand-tagged games.
2. Games tab (the substitution timeline) — the easiest view to check against what really happened.
3. Minute/spell engine, checked against a few games by hand.
4. Players and Team tabs with filters.
5. PDF import for your stats provider.
6. Bench, Sub Strategy, Environment and Player Profile.
7. GPS import and PDF exports.

Validate each step against real box scores before moving on; small clock or re-entry errors spread through every average.

## 8. Offline / downloadable copy

To hand the board to someone without Claude access, replace the runtime with a small shim that serves an in-memory `db` (seeded from an embedded JSON export) and a `downloads` that triggers a normal browser download. The rest of the page runs unchanged. This is how the downloadable Gator Sub Board copy was made.

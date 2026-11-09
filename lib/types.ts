// Shared data shapes. Ported verbatim from the original artifact (gator-sub-board.html).
// Players are keyed by LAST NAME everywhere (matches the original board).

export type Venue = 'Home' | 'Away' | 'Neutral';
export type Result = 'W' | 'L' | 'T';
export type Pos = 'GK' | 'DEF' | 'MID' | 'FWD' | '';
export type TeamCode = 'UF' | 'OPP';

export interface LineupPlayer {
  name: string; // last name (key)
  first?: string;
  num?: string;
  pos?: Pos;
  min?: number; // box-score minutes
  sh?: number;
  g?: number;
  a?: number;
}

export interface OppLineupPlayer {
  name: string;
  num?: string;
  min?: number;
}

export interface Lineup {
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export type EventType = 'SUB' | 'GOAL' | 'SHOT' | 'CARD' | 'CORNER' | 'FOUL' | 'OFFSIDE';

export interface GameEvent {
  half: number; // 1, 2, 3+ = OT
  clock: string; // "mm:ss" match time
  t: number; // cumulative match seconds (2H starts at 2700)
  type: EventType;
  team: TeamCode;
  on?: string; // SUB
  off?: string; // SUB
  player?: string; // GOAL / SHOT / CARD
  pk?: boolean; // GOAL
  sog?: boolean; // SHOT
  card?: 'yellow' | 'red'; // CARD
}

export interface GameEnv {
  kickoff?: string; // "HH:MM" local
  kickoffSrc?: string;
  tempF?: number | null;
  dewF?: number | null;
  uv?: number | null;
  rh?: number | null;
  windMph?: number | null;
  precipIn?: number | null;
  src?: 'manual' | 'open-meteo' | 'pdf' | string;
  lat?: number;
  lon?: number;
}

export interface Game {
  id: string; // `${date}-${slug(opp)}`
  date: string; // YYYY-MM-DD
  opp: string;
  venue: Venue;
  location?: string;
  gf: number;
  ga: number;
  result: Result;
  ht?: { uf: number; opp: number };
  source?: 'pdf' | 'manual' | 'csv' | 'ncaa' | string;
  ncaaId?: string; // ncaa.com contestId when source === 'ncaa'
  tier: 'P4' | 'Non-P4' | string;
  conf?: 'SEC' | 'Non-conf' | string;
  stage?: 'Postseason' | string;
  notes?: string;
  addedAt?: string;
  env?: GameEnv;
  lineup: Lineup;
  oppLineup?: { starters: OppLineupPlayer[]; bench: OppLineupPlayer[] };
  events: GameEvent[];
}

export interface LoadRow {
  player: string; // matched last name
  half: 1 | 2;
  dist?: number;
  hsr?: number;
  sprint?: number;
  acc?: number; // accels + decels
}

export interface GameLoads {
  rows: LoadRow[];
  updatedAt?: string;
}

export type LoadsByGame = Record<string, GameLoads>;
/** Keyed by last name. num/first fill or override box-score values for display ("#19 - Mary Jane"). */
export type Roster = Record<string, { pos: Pos; num?: string; first?: string }>;

/** Full JSON export format (same as original "Download all data (JSON)"). */
export interface BoardExport {
  games: Game[];
  roster: Roster | { players: Roster };
  loads: LoadsByGame;
}

export type Scope = 'h1' | 'h2' | 'full';

export interface Filters {
  tier: 'All' | 'P4' | 'SEC' | 'Non-P4';
  result: 'All' | Result;
  venue: 'All' | 'Home' | 'Away';
  recent: 'All' | 'Last 5' | 'Last 3';
}

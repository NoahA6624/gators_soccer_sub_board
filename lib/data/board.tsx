'use client';
// Board context: data (games/loads/roster/canEdit) + shared UI state (filters, scope).
// DATA LOADING OWNED BY AGENT B (replace the stub effect with Supabase + realtime).
// UI state shape is a contract — do not rename fields.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Filters, Game, LoadsByGame, Roster, Scope } from '@/lib/types';
import { getBrowserClient } from '@/lib/supabase/client';
import { SUPABASE_MISSING_MSG } from '@/lib/supabase/env';
import { onBoardChange, type BoardChange } from './bus';
import {
  loadsFromRows, normalizeRoster, removeGame, rowToGame, rowToLoads, sortGames, upsertGame,
  type GameRow, type LoadsRow, type RosterRow,
} from './rows';

export interface BoardCtx {
  games: Game[];
  loads: LoadsByGame;
  roster: Roster;
  canEdit: boolean;
  loading: boolean;
  error: string | null;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  scope: Scope;
  setScope: (s: Scope) => void;
  /** Per-tab persisted UI state (sorts, selections). Key by tab name. */
  ui: Record<string, unknown>;
  setUi: (tab: string, v: unknown) => void;
}

const Ctx = createContext<BoardCtx | null>(null);
const LS = 'gsb-v2';
const DEFAULT_F: Filters = { tier: 'All', result: 'All', venue: 'All', recent: 'All' };

export function BoardProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<Game[]>([]);
  const [loads, setLoads] = useState<LoadsByGame>({});
  const [roster, setRoster] = useState<Roster>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setF] = useState<Filters>(DEFAULT_F);
  const [scope, setScope] = useState<Scope>('h1');
  const [ui, setUiState] = useState<Record<string, unknown>>({});

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || '{}');
      if (s.filters) setF({ ...DEFAULT_F, ...s.filters });
      if (s.scope) setScope(s.scope);
      if (s.ui) setUiState(s.ui);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS, JSON.stringify({ filters, scope, ui })); } catch {}
  }, [filters, scope, ui]);

  // Supabase: initial fetch + profile role, then realtime postgres_changes on games/loads/roster.
  useEffect(() => {
    const sb = getBrowserClient();
    if (!sb) { setError(SUPABASE_MISSING_MSG); setLoading(false); return; }
    let alive = true;

    const apply = (c: BoardChange) => {
      if (!alive) return;
      switch (c.kind) {
        case 'game': setGames((p) => upsertGame(p, c.game)); break;
        case 'gameDeleted': setGames((p) => removeGame(p, c.id)); break;
        case 'loads': setLoads((p) => ({ ...p, [c.gameId]: c.loads })); break;
        case 'loadsDeleted': setLoads((p) => { if (!(c.gameId in p)) return p; const n = { ...p }; delete n[c.gameId]; return n; }); break;
        case 'roster': setRoster(c.roster); break;
      }
    };
    const offBus = onBoardChange(apply);

    const channel = sb.channel('board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, (p) => {
        if (p.eventType === 'DELETE') { const id = (p.old as Partial<GameRow>).id; if (id) apply({ kind: 'gameDeleted', id }); }
        else apply({ kind: 'game', game: rowToGame(p.new as GameRow) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, (p) => {
        if (p.eventType === 'DELETE') { const id = (p.old as Partial<LoadsRow>).game_id; if (id) apply({ kind: 'loadsDeleted', gameId: id }); }
        else { const r = p.new as LoadsRow; apply({ kind: 'loads', gameId: r.game_id, loads: rowToLoads(r) }); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roster' }, (p) => {
        if (p.eventType === 'DELETE') apply({ kind: 'roster', roster: {} });
        else apply({ kind: 'roster', roster: normalizeRoster((p.new as RosterRow).players) });
      });

    (async () => {
      try {
        const { data: auth } = await sb.auth.getUser();
        const user = auth.user;
        if (!user) throw new Error('Not signed in.');
        const [g, l, r, prof] = await Promise.all([
          sb.from('games').select('id,date,doc').order('date', { ascending: true }),
          sb.from('loads').select('game_id,rows,updated_at'),
          sb.from('roster').select('id,players').eq('id', 'roster').maybeSingle(),
          sb.from('profiles').select('role').eq('user_id', user.id).maybeSingle(),
        ]);
        const err = g.error || l.error || r.error || prof.error;
        if (err) throw new Error(err.message);
        if (!alive) return;
        setGames(sortGames(((g.data ?? []) as GameRow[]).map(rowToGame)));
        setLoads(loadsFromRows((l.data ?? []) as LoadsRow[]));
        setRoster(normalizeRoster((r.data as RosterRow | null)?.players));
        setCanEdit(prof.data?.role === 'editor');
        // Subscribe after the snapshot so a stale fetch can't overwrite a newer realtime event.
        channel.subscribe((status) => {
          if (!alive) return;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Live updates disconnected — reload to resync.');
        });
      } catch (e) {
        if (alive) setError(`Could not load board data: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; offBus(); void sb.removeChannel(channel); };
  }, []);

  const value = useMemo<BoardCtx>(() => ({
    games, loads, roster, canEdit, loading, error,
    filters, setFilters: (f) => setF((p) => ({ ...p, ...f })),
    scope, setScope,
    ui, setUi: (tab, v) => setUiState((p) => ({ ...p, [tab]: v })),
  }), [games, loads, roster, canEdit, loading, error, filters, scope, ui]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoard() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBoard outside BoardProvider');
  return c;
}

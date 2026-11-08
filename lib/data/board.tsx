'use client';
// Board context: data (games/loads/roster/canEdit) + shared UI state (filters, scope).
// DATA LOADING OWNED BY AGENT B (replace the stub effect with Supabase + realtime).
// UI state shape is a contract — do not rename fields.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Filters, Game, LoadsByGame, Roster, Scope } from '@/lib/types';

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

  // STUB: agent B replaces with Supabase fetch + realtime subscriptions + profile role.
  useEffect(() => {
    void setGames; void setLoads; void setRoster; void setCanEdit; void setError;
    setLoading(false);
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

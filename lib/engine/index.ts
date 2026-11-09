// Engine public API. OWNED BY AGENT A (engine). Other agents import from '@/lib/engine' only.
// Port of gator-sub-board.html L620–782 and tab engines. Function names match the original;
// implicit globals (S.roster, S.games, S.loads, S.eheat, ...) are explicit params / EngineOpts.
export type { Scope } from '@/lib/types';
export * from './util';
export * from './names';
export * from './core';
export * from './aggregates';
export * from './bench';
export * from './env';
export * from './profile';
export * from './strategy';
export * from './scenario';

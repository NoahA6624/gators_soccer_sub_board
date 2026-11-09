'use client';
// Segmented control (port of seg(), L785). Markup: <div class="seg" role="group"><button aria-pressed>…
//
//   <Seg options={[['All','All'],['W','Wins']]} value={v} onChange={setV} />
//   options: [value, label] pairs (label may be a node); disabled?: values to disable.
import type { ReactNode } from 'react';

export interface SegProps<V extends string> {
  options: ReadonlyArray<readonly [V, ReactNode]>;
  value: V;
  onChange: (v: V) => void;
  disabled?: ReadonlyArray<V>;
  ariaLabel?: string;
}

export function Seg<V extends string>({ options, value, onChange, disabled, ariaLabel }: SegProps<V>) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} disabled={disabled?.includes(v)} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Labelled wrapper: <div class="fgroup"><span class="label">…</span>{children}</div> */
export function FGroup({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="fgroup">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

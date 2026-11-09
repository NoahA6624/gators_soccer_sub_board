'use client';
// Minimal local segmented control (`.seg`). Shared version lives in components/ui (other agent).
export function Seg<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T | ((v: T) => boolean);
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const pressed = (v: T) => (typeof value === 'function' ? (value as (v: T) => boolean)(v) : value === v);
  return (
    <div className="fgroup">
      <span className="label">{label}</span>
      <div className="seg" role="group">
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" aria-pressed={pressed(v)} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

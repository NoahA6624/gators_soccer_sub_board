// Port of donutSVG (L1598–1608).
export function Donut({ s, b, size, big, title }: { s: number; b: number; size: number; big?: boolean; title?: string }) {
  const r = size / 2 - (big ? 16 : 9), c = size / 2, C = 2 * Math.PI * r, sw = big ? 30 : 15, frac = b / (s + b || 1);
  const gap = big ? 3 : 2;
  const bl = Math.max(0, C * frac - gap), sl = Math.max(0, C * (1 - frac) - gap);
  const pct = Math.round(frac * 100);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, height: 'auto', display: 'block', margin: '0 auto' }} role="img" aria-label={`${pct}% bench minutes`}>
      {title && <title>{title}</title>}
      <g transform={`rotate(-90 ${c} ${c})`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bench-st)" strokeWidth={sw} strokeDasharray={`${sl} ${C - sl}`} strokeDashoffset={-(C * frac + gap / 2)} />
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bench-be)" strokeWidth={sw} strokeDasharray={`${bl} ${C - bl}`} strokeDashoffset={-gap / 2} />
      </g>
      <text x={c} y={c + (big ? 6 : 5)} textAnchor="middle" fontFamily="var(--display)" fontWeight={700} fontSize={big ? 44 : 20} fill="var(--ink)">{pct}%</text>
      {big && <text x={c} y={c + 30} textAnchor="middle" fontSize={14} fill="var(--muted)">bench</text>}
    </svg>
  );
}

'use client';
// Minimal local tooltip (port of showTip, L610–618). Shared one lives in components/ui (other agent).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';

type Bind = (content: ReactNode) => {
  'data-tip': string;
  onMouseMove: (e: MouseEvent) => void;
  onMouseLeave: () => void;
  onClick: (e: MouseEvent) => void;
};

const TipCtx = createContext<Bind | null>(null);

export function TipHost({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ c: ReactNode; x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const bind = useCallback<Bind>((c) => {
    const show = (e: MouseEvent) => setTip({ c, x: e.clientX, y: e.clientY });
    return { 'data-tip': '', onMouseMove: show, onClick: show, onMouseLeave: () => setTip(null) };
  }, []);
  useEffect(() => {
    const h = () => setTip(null);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    let x = tip.x + 14, y = tip.y + 14;
    if (x + r.width > innerWidth - 8) x = tip.x - r.width - 14;
    if (y + r.height > innerHeight - 8) y = tip.y - r.height - 14;
    el.style.left = Math.max(8, x) + 'px';
    el.style.top = Math.max(8, y) + 'px';
  }, [tip]);
  return (
    <TipCtx.Provider value={bind}>
      {children}
      <div ref={ref} className="tip" hidden={!tip}>{tip?.c}</div>
    </TipCtx.Provider>
  );
}

export function useTip(): Bind {
  const b = useContext(TipCtx);
  return b ?? (() => ({ 'data-tip': '', onMouseMove: () => {}, onMouseLeave: () => {}, onClick: () => {} }));
}

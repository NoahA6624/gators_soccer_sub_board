'use client';
// Hover tooltip system (port of L610–618: `tip()` + data-tip + #tip element).
//
//   <TipProvider>...</TipProvider>      Mount once around a tab's content. Renders the fixed `.tip` box.
//   const tip = useTip();               Returns (content) => event props to spread on ANY element (incl. SVG):
//     <rect {...tip(<b>hello</b>)} />    content = ReactNode, or { html: string } (sanitised: only <b>/<br> kept).
//   <Tip content={node}><tr>…</tr></Tip>   Wrapper form: clones its single child with the handlers.
//   <Tip html="<b>x</b>"><rect/></Tip>
//
// Without a provider, useTip()/Tip are no-ops (render children unchanged).
import {
  cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type HTMLAttributes, type MouseEvent as RMouseEvent, type ReactElement, type ReactNode,
} from 'react';
import { safeHtml } from './util';

export type TipContent = ReactNode | { html: string };
type Handlers = Pick<HTMLAttributes<Element>, 'onMouseMove' | 'onMouseLeave' | 'onClick'>;

interface TipApi { show: (e: RMouseEvent<Element>, c: TipContent) => void; hide: () => void }
const TipCtx = createContext<TipApi | null>(null);

const isHtml = (c: TipContent): c is { html: string } =>
  !!c && typeof c === 'object' && !isValidElement(c) && 'html' in (c as object);
const same = (a: TipContent | null, b: TipContent | null) =>
  a === b || (a != null && b != null && isHtml(a) && isHtml(b) && a.html === b.html);

export function TipProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<TipContent | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const pt = useRef({ x: 0, y: 0 });

  const place = useCallback(() => {
    const t = el.current;
    if (!t || t.hidden) return;
    const r = t.getBoundingClientRect();
    const { x: cx, y: cy } = pt.current;
    let x = cx + 14, y = cy + 14;
    if (x + r.width > innerWidth - 8) x = cx - r.width - 14;
    if (y + r.height > innerHeight - 8) y = cy - r.height - 14;
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = Math.max(8, y) + 'px';
  }, []);

  useLayoutEffect(() => { place(); }, [content, place]);
  useEffect(() => {
    const h = () => setContent(null);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const api = useMemo<TipApi>(() => ({
    show: (e, c) => {
      pt.current = { x: e.clientX, y: e.clientY };
      setContent((prev) => (same(prev, c) ? prev : c));
      place();
    },
    hide: () => setContent(null),
  }), [place]);

  const hidden = content == null || content === false || content === '';
  return (
    <TipCtx.Provider value={api}>
      {children}
      {content != null && isHtml(content) ? (
        <div ref={el} className="tip" role="tooltip" hidden={hidden} dangerouslySetInnerHTML={{ __html: safeHtml(content.html) }} />
      ) : (
        <div ref={el} className="tip" role="tooltip" hidden={hidden}>{hidden ? null : (content as ReactNode)}</div>
      )}
    </TipCtx.Provider>
  );
}

/** Returns a function mapping tooltip content to event props. */
export function useTip(): (c: TipContent) => Handlers {
  const api = useContext(TipCtx);
  return useCallback((c: TipContent): Handlers => {
    if (!api) return {};
    return { onMouseMove: (e) => api.show(e, c), onMouseLeave: () => api.hide(), onClick: (e) => api.show(e, c) };
  }, [api]);
}

/** Wrapper form. Exactly one child element; its own onClick (if any) still runs. */
export function Tip({ html, content, children }: { html?: string; content?: ReactNode; children: ReactElement<Handlers> }) {
  const tip = useTip();
  const h = tip(html != null ? { html } : content);
  const own = children.props;
  return cloneElement(children, {
    ...h,
    onClick: (e: RMouseEvent<Element>) => { own.onClick?.(e); h.onClick?.(e); },
  });
}

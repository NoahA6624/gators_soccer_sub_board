'use client';
import { useState } from 'react';

export type Msg = { kind: 'ok' | 'err' | 'warn' | 'muted' | 'plain'; text: string; lines?: string[] } | null;

export const errText = (e: unknown) => {
  const x = e as { code?: string; message?: string };
  return x?.code || x?.message || String(e);
};

export function useMsg() {
  return useState<Msg>(null);
}

export function Status({ msg }: { msg: Msg }) {
  if (!msg) return <div className="status" />;
  return (
    <div className="status">
      {msg.kind === 'plain' ? msg.text : <span className={msg.kind}>{msg.text}</span>}
      {msg.lines?.length ? <div className={msg.kind === 'err' ? 'err' : 'warn'}>{msg.lines.map((l, i) => <div key={i}>{l}</div>)}</div> : null}
    </div>
  );
}

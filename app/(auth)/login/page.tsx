'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { SUPABASE_MISSING_MSG } from '@/lib/supabase/env';

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(params.get('error'));
  const sb = getBrowserClient();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    const next = params.get('next');
    const cb = new URL('/auth/callback', window.location.origin);
    if (next && next.startsWith('/') && !next.startsWith('//')) cb.searchParams.set('next', next);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: cb.toString() } });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="panel" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginTop: 0 }}>Sign in</h2>
      {!sb ? (
        <p className="muted">{SUPABASE_MISSING_MSG}</p>
      ) : sent ? (
        <p>Check <b>{email}</b> for a sign-in link. You can close this tab.</p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>We&apos;ll email you a magic link — no password needed.</p>
          <label className="field">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ufl.edu" />
          </label>
          <button className="btn primary" type="submit" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send magic link'}</button>
        </form>
      )}
      {err && <p style={{ color: 'var(--loss)', marginBottom: 0 }}>{err}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand"><h1>Gator <span>Sub</span> Board</h1></div>
      </header>
      <Suspense fallback={null}><LoginForm /></Suspense>
    </div>
  );
}

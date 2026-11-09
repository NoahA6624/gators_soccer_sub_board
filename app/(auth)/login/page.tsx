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
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(params.get('error'));
  const sb = getBrowserClient();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    const next = params.get('next');
    const cb = new URL('/auth/callback', window.location.origin);
    // Always set `next` so an email template can append `&token_hash=…` to {{ .RedirectTo }}.
    cb.searchParams.set('next', next && next.startsWith('/') && !next.startsWith('//') ? next : '/team');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: cb.toString() } });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  // 6-digit code from the email: works even when the link opens in another browser/device (PKCE links don't).
  async function onCode(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const next = params.get('next');
    window.location.assign(next && next.startsWith('/') && !next.startsWith('//') ? next : '/team');
  }

  return (
    <div className="panel" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginTop: 0 }}>Sign in</h2>
      {!sb ? (
        <p className="muted">{SUPABASE_MISSING_MSG}</p>
      ) : sent ? (
        <form onSubmit={onCode} style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0 }}>Check <b>{email}</b> for a sign-in link. Open it in this browser, or type the code from the email here.</p>
          <label className="field">
            Code
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/D/g, '').slice(0, 10))} placeholder="123456" />
          </label>
          <button className="btn primary" type="submit" disabled={busy || code.trim().length < 6}>{busy ? 'Checking…' : 'Sign in with code'}</button>
        </form>
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

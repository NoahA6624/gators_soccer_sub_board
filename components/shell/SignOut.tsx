'use client';
import { useState } from 'react';
import { signOut } from '@/lib/data/mutations';

export function SignOut() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn noprint"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { await signOut(); } finally { window.location.assign('/login'); }
      }}
    >
      Sign out
    </button>
  );
}

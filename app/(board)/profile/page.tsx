'use client';
// Player Profile tab (agent G). Supports deep links: /profile?player=<last>.
import { Suspense } from 'react';
import { ProfileTab } from '@/components/games/ProfileTab';

export default function Page() {
  return (
    <Suspense fallback={<div className="panel empty">Loading…</div>}>
      <ProfileTab />
    </Suspense>
  );
}

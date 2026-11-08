'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBoard } from '@/lib/data/board';

export const TABS = [
  { href: '/team', label: 'Team' },
  { href: '/players', label: 'Players' },
  { href: '/profile', label: 'Player Profile' },
  { href: '/games', label: 'Games' },
  { href: '/strategy', label: 'Sub Strategy' },
  { href: '/bench', label: 'Bench' },
  { href: '/env', label: 'Environment' },
  { href: '/import', label: 'Add data', editorOnly: true },
] as const;

export function TabNav() {
  const path = usePathname();
  const { canEdit } = useBoard();
  return (
    <nav className="tabs" role="tablist" aria-label="Sections">
      {TABS.filter((t) => !('editorOnly' in t) || canEdit).map((t) => (
        <Link key={t.href} href={t.href} role="tab" className="tab" aria-selected={path === t.href}>{t.label}</Link>
      ))}
    </nav>
  );
}

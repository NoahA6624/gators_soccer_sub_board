import { BoardProvider } from '@/lib/data/board';
import { TabNav } from '@/components/shell/TabNav';
import { Subtitle } from '@/components/shell/Subtitle';
import { SignOut } from '@/components/shell/SignOut';

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BoardProvider>
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <h1>Gator <span>Sub</span> Board</h1>
            <Subtitle />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><TabNav /><SignOut /></div>
        </header>
        <main id="app">{children}</main>
        <p className="foot">
          1st half: no re-entry within the half; still on at halftime counts as 45&apos;. 2nd half: the &quot;starters&quot; are the players on at the restart (after halftime changes); in-play subs exclude halftime changes. Full match: spells are rebuilt from every sub, including re-entry; the &quot;minutes into a spell&quot; clock starts at entry or at a restart. Shots include goals. SEC = SEC opponents unless changed on import. Positions are box-score labels unless edited in Add data. Source: official box score and play-by-play, NCAA live stats, or your own tagged CSVs. Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a> (CC BY 4.0).
        </p>
      </div>
    </BoardProvider>
  );
}

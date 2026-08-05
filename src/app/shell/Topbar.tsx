import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { findModuleByPath } from '@/app/modules';
import { usePalette, useSovereign } from '@/app/context';
import { countDemoRows } from '@/data/dataset';
import { formatClockTime } from '@/lib/clock';
import { DemoBadge, Kbd } from '@/ui/primitives';

function useTick(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, intervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function Topbar() {
  const location = useLocation();
  const { openPalette } = usePalette();
  const { dataset, ready } = useSovereign();
  const now = useTick(30_000);

  const module = findModuleByPath(location.pathname);
  const demoRows = countDemoRows(dataset);

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-surface/40 px-4">
      <div className="min-w-0">
        <h1 className="truncate font-display text-sm text-ivory">{module?.label ?? 'Sovereign'}</h1>
      </div>

      <button
        type="button"
        onClick={() => {
          openPalette('search');
        }}
        className="group ml-auto flex h-8 w-72 max-w-[45vw] items-center gap-2 border border-line bg-surface-high/60 px-2.5 text-left text-xs text-faint transition-colors hover:border-gold/40 hover:text-muted"
        aria-label="Search records"
      >
        <Search className="size-3.5" strokeWidth={1.5} aria-hidden />
        <span className="flex-1 truncate">Search records</span>
        <Kbd>/</Kbd>
      </button>

      <button
        type="button"
        onClick={() => {
          openPalette('commands');
        }}
        className="flex h-8 items-center gap-2 border border-line bg-surface-high/60 px-2.5 text-xs text-faint transition-colors hover:border-gold/40 hover:text-muted"
        aria-label="Open command palette"
      >
        <span>Commands</span>
        <Kbd>⌘K</Kbd>
      </button>

      {ready && demoRows > 0 ? (
        <div className="flex items-center gap-2" title={`${String(demoRows)} demo records in the local store`}>
          <DemoBadge />
          <span className="font-mono text-[0.65rem] text-faint tabular-nums">{demoRows}</span>
        </div>
      ) : null}

      <span className="font-mono text-xs text-faint tabular-nums">{formatClockTime(now)}</span>
    </header>
  );
}

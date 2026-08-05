import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft } from 'lucide-react';
import { usePalette, useSovereign } from '@/app/context';
import { normalizeInternalHref } from '@/app/href';
import { buildCommands, commandGroupLabel, type Command } from '@/commands/registry';
import { db } from '@/data/db';
import { markAllNotificationsRead } from '@/data/mutations';
import { resetLocalStore, seedDemoData } from '@/data/repositories';
import { rankByFuzzy } from '@/search/fuzzy';
import { searchDocuments, searchKindLabel, type SearchDocument } from '@/search';
import { cn } from '@/lib/cn';
import { DemoBadge, Kbd } from '@/ui/primitives';

type Row =
  | { kind: 'command'; key: string; group: string; command: Command }
  | { kind: 'record'; key: string; group: string; document: SearchDocument };

interface DisplayRow {
  row: Row;
  showGroup: boolean;
}

function PaletteDialog() {
  const { mode, openPalette, closePalette } = usePalette();
  const { searchIndex } = useSovereign();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const commands = useMemo(
    () =>
      buildCommands({
        navigate: (path) => {
          void navigate(path);
        },
        reseedDemoData: () => seedDemoData(db, new Date()),
        resetStore: async () => {
          await resetLocalStore(db);
          await seedDemoData(db, new Date());
        },
        markAllRead: async () => {
          await markAllNotificationsRead(db);
        },
        openSearch: () => {
          openPalette('search');
        },
      }),
    [navigate, openPalette],
  );

  const rows = useMemo<Row[]>(() => {
    const records = (limit: number): Row[] =>
      searchDocuments(query, searchIndex, limit).map(({ item }) => ({
        kind: 'record' as const,
        key: item.id,
        group: 'Records',
        document: item,
      }));

    if (mode === 'search') return records(14);

    const matched =
      query.trim().length === 0
        ? commands
        : rankByFuzzy(
            query,
            commands,
            (command) => [command.label, command.hint, command.keywords.join(' ')],
            { limit: 10, minScore: 12 },
          ).map(({ item }) => item);

    const commandRows: Row[] = matched.map((command) => ({
      kind: 'command' as const,
      key: command.id,
      group: commandGroupLabel[command.group],
      command,
    }));

    return [...commandRows, ...records(6)];
  }, [mode, query, commands, searchIndex]);

  const displayRows = useMemo<DisplayRow[]>(
    () => rows.map((row, index) => ({ row, showGroup: rows[index - 1]?.group !== row.group })),
    [rows],
  );

  const active = rows.length === 0 ? 0 : Math.min(cursor, rows.length - 1);

  const runRow = useCallback(
    (row: Row) => {
      closePalette();
      if (row.kind === 'command') {
        void row.command.run();
      } else {
        void navigate(normalizeInternalHref(row.document.route, '/'));
      }
    },
    [closePalette, navigate],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor(rows.length === 0 ? 0 : (active + 1) % rows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor(rows.length === 0 ? 0 : (active - 1 + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[active];
      if (row) runRow(row);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-obsidian/70 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePalette();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'search' ? 'Global search' : 'Command palette'}
        className="w-full max-w-2xl border border-line-strong bg-surface/95 shadow-2xl backdrop-blur-md"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span className="label-caps text-gold">{mode === 'search' ? 'Search' : 'Command'}</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder={
              mode === 'search'
                ? 'Find people, tasks, opportunities, content…'
                : 'Type a command or search…'
            }
            className="h-12 flex-1 bg-transparent text-sm text-ivory outline-none placeholder:text-faint"
            aria-label={mode === 'search' ? 'Search query' : 'Command query'}
          />
          <Kbd>esc</Kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto py-1">
          {displayRows.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-faint italic">
              {query.trim().length === 0 ? 'Type to search the local store.' : 'No matches.'}
            </li>
          ) : null}

          {displayRows.map(({ row, showGroup }, index) => (
            <li key={row.key}>
              {showGroup ? (
                <p className="label-caps px-4 pt-2.5 pb-1 text-faint">{row.group}</p>
              ) : null}
              <button
                type="button"
                onMouseEnter={() => {
                  setCursor(index);
                }}
                onClick={() => {
                  runRow(row);
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                  index === active ? 'bg-gold-faint text-ivory' : 'text-muted',
                )}
              >
                {row.kind === 'command' ? (
                  <row.command.icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                ) : (
                  <span className="label-caps w-20 shrink-0 text-faint">
                    {searchKindLabel[row.document.kind]}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {row.kind === 'command' ? row.command.label : row.document.title}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {row.kind === 'command' ? row.command.hint : row.document.subtitle}
                  </span>
                </span>
                {row.kind === 'record' && row.document.demo ? <DemoBadge /> : null}
                {index === active ? (
                  <CornerDownLeft
                    className="size-3.5 shrink-0 text-gold"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[0.65rem] text-faint">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> run
          </span>
          <span className="ml-auto">Local store only. No network calls.</span>
        </div>
      </div>
    </div>
  );
}

/** Mounted only while open so query and cursor state reset on every invocation. */
export function CommandPalette() {
  const { open, mode } = usePalette();
  if (!open) return null;
  return <PaletteDialog key={mode} />;
}

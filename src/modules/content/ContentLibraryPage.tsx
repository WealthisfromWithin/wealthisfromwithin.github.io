import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel } from '@/ui/primitives';
import { ContentTabs } from './ContentTabs';
import {
  LIBRARY_TYPES,
  contentFormatLabel,
  contentPlatformLabel,
  libraryTypeLabel,
  libraryUsage,
  parseLibraryType,
  type LibraryType,
} from './content';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors';

interface LibraryRow {
  id: string;
  demo: boolean;
  primary: string;
  secondary: string;
  meta: string;
}

function rowsFor(
  dataset: ReturnType<typeof useSovereign>['dataset'],
  type: LibraryType,
): LibraryRow[] {
  switch (type) {
    case 'hooks':
      return dataset.hooks.map((hook) => ({
        id: hook.id,
        demo: hook.source === 'demo',
        primary: hook.text,
        secondary: hook.notes,
        meta: [hook.style, hook.platform ? contentPlatformLabel[hook.platform] : null]
          .filter((part): part is string => part !== null)
          .join(' · '),
      }));
    case 'ctas':
      return dataset.ctas.map((cta) => ({
        id: cta.id,
        demo: cta.source === 'demo',
        primary: cta.text,
        secondary: cta.notes,
        meta: [cta.intent.replace('_', ' '), cta.destination].filter(Boolean).join(' · '),
      }));
    case 'assets':
      return dataset.contentAssets.map((asset) => ({
        id: asset.id,
        demo: asset.source === 'demo',
        primary: asset.title,
        secondary: asset.notes,
        meta: [asset.kind, asset.location].filter(Boolean).join(' · '),
      }));
    case 'templates':
      return dataset.contentTemplates.map((template) => ({
        id: template.id,
        demo: template.source === 'demo',
        primary: template.title,
        secondary: template.structure,
        meta: [contentFormatLabel[template.format], template.whenToUse].filter(Boolean).join(' · '),
      }));
  }
}

const emptyMessage: Record<LibraryType, string> = {
  hooks: 'No hooks recorded.',
  ctas: 'No calls to action recorded.',
  assets: 'No assets recorded.',
  templates: 'No templates recorded.',
};

export function ContentLibraryPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = parseLibraryType(searchParams.get('type'));

  const rows = useMemo(() => rowsFor(dataset, type), [dataset, type]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>
          <Link to="/content" className="hover:text-ivory">
            Content
          </Link>{' '}
          · Library
        </SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Library</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Hooks, calls to action, assets, and templates behind one filter rather than four thin
          pages. Usage is counted from the items that reference each row, so it cannot drift from
          the store.
        </p>
      </header>

      <ContentTabs />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {LIBRARY_TYPES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              if (value !== 'hooks') params.set('type', value);
              setSearchParams(params);
            }}
            className={cn(
              filterButton,
              type === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {libraryTypeLabel[value]}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">{emptyMessage[type]}</p>
      ) : (
        <ul>
          {rows.map((row) => {
            const usage = libraryUsage(dataset, type, row.id);
            return (
              <li key={row.id} className="border-b border-line/60 py-2.5 last:border-b-0">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ivory">{row.primary}</span>
                      {row.demo ? <DemoBadge /> : null}
                    </div>
                    {row.secondary.length > 0 ? (
                      <p className="mt-0.5 text-xs leading-5 text-muted">{row.secondary}</p>
                    ) : null}
                    <p className="mt-0.5 font-mono text-[0.65rem] text-faint">{row.meta}</p>
                  </div>
                  <span
                    className="shrink-0 pt-0.5 font-mono text-[0.65rem] text-faint tabular-nums"
                    title="Content items referencing this row"
                  >
                    used {usage}×
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

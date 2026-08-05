import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { deriveSubstrateHealth } from '@/integrations/state';
import { formatCurrencyCents } from '@/lib/format';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel } from '@/ui/primitives';
import { buildMorningBrief, type BriefItem, type BriefSection, type BriefTone } from './brief';

const toneAccent: Record<BriefTone, string> = {
  critical: 'before:bg-alert',
  warning: 'before:bg-gold',
  info: 'before:bg-sentinel',
  neutral: 'before:bg-surface-highest',
};

function BriefRow({ item }: { item: BriefItem }) {
  const body = (
    <>
      <span
        className={cn(
          'relative min-w-0 flex-1 pl-3 before:absolute before:top-1 before:bottom-1 before:left-0 before:w-px',
          toneAccent[item.tone],
        )}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 text-sm text-ivory">{item.title}</span>
          {item.demo ? <DemoBadge /> : null}
        </span>
        {item.detail ? (
          <span className="mt-0.5 block text-xs leading-5 text-muted">{item.detail}</span>
        ) : null}
      </span>
      {item.meta ? (
        <span className="w-32 shrink-0 pt-0.5 text-right font-mono text-[0.65rem] leading-4 text-faint tabular-nums">
          {item.meta}
        </span>
      ) : null}
    </>
  );

  return (
    <li className="border-b border-line/60 last:border-b-0">
      {item.href ? (
        <Link
          to={item.href}
          className="flex items-start gap-4 py-2 transition-colors hover:bg-surface-high/40"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-4 py-2">{body}</div>
      )}
    </li>
  );
}

function QuestionBlock({ section, index }: { section: BriefSection; index: number }) {
  return (
    <section aria-labelledby={`brief-${section.id}`} className="min-w-0">
      <header className="mb-1.5 flex items-baseline gap-2 border-b border-line pb-1.5">
        <span className="font-mono text-[0.65rem] text-gold tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 id={`brief-${section.id}`} className="font-display text-sm text-ivory">
          {section.question}
        </h2>
        <span className="ml-auto font-mono text-[0.65rem] text-faint tabular-nums">
          {section.items.length}
        </span>
      </header>
      <p className="mb-1 text-xs text-faint">{section.lens}</p>
      {section.items.length === 0 ? (
        <p className="py-2 text-sm text-faint italic">{section.emptyMessage}</p>
      ) : (
        <ul>
          {section.items.map((item) => (
            <BriefRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function MorningBriefPage() {
  const { dataset, ready, error } = useSovereign();
  const now = useMemo(() => new Date(), []);
  const brief = useMemo(() => buildMorningBrief(dataset, now), [dataset, now]);
  const health = deriveSubstrateHealth(dataset.integrations);

  const openPipelineCents = dataset.opportunities
    .filter((opportunity) => opportunity.stage !== 'won' && opportunity.stage !== 'lost')
    .reduce((total, opportunity) => total + opportunity.valueCents, 0);

  const blockedCount = brief.sections.find((section) => section.id === 'blocked')?.items.length ?? 0;
  const attentionCount =
    brief.sections.find((section) => section.id === 'attention')?.items.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-6">
        <SectionLabel>
          {now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Morning Brief</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Six questions, answered from the local store. Every seeded row is badged; nothing here is
          fetched from a network.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Needs attention</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{attentionCount}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Blocked</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{blockedCount}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open pipeline</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              {formatCurrencyCents(openPipelineCents)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="label-caps text-faint">Substrate</dt>
            <dd
              className={cn(
                'font-mono text-xs',
                health.status === 'operational'
                  ? 'text-sentinel'
                  : health.status === 'degraded'
                    ? 'text-gold'
                    : 'text-faint',
              )}
            >
              <Link to="/integrations" className="hover:text-ivory">
                {health.statement}
              </Link>
            </dd>
          </div>
        </dl>
      </header>

      {error ? (
        <p className="mb-4 border border-alert/50 px-3 py-2 text-sm text-alert">
          Local store error: {error}
        </p>
      ) : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 gap-y-7 lg:grid-cols-2">
          {brief.sections.map((section, index) => (
            <QuestionBlock key={section.id} section={section} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref, personHref } from '@/app/href';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatCurrencyCents } from '@/lib/format';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  CRM_TEMPERATURES,
  CRM_VIEWS,
  crmCounts,
  crmViewLabel,
  parseCrmQuery,
  selectCompanies,
  selectPeople,
  temperatureLabel,
  temperatureTone,
  type CrmQuery,
  type CompanyRow,
  type PersonRow,
} from './crm';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors';

function TemperaturePill({ row }: { row: PersonRow }) {
  return (
    <StatePill
      tone={temperatureTone[row.temperature]}
      title="Derived from the last recorded touch, not from a score"
    >
      {temperatureLabel[row.temperature]}
    </StatePill>
  );
}

function PersonRowView({ row, now }: { row: PersonRow; now: Date }) {
  return (
    <tr className="border-b border-line/60 align-top last:border-b-0">
      <td className="py-2.5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={personHref(row.person.id)} className="text-sm text-ivory hover:text-gold">
            {row.person.name}
          </Link>
          {row.person.source === 'demo' ? <DemoBadge /> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {[row.person.role, row.company?.name].filter(Boolean).join(' · ')}
        </p>
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        <TemperaturePill row={row} />
      </td>
      <td className="py-2.5 pr-4 font-mono text-[0.65rem] whitespace-nowrap text-faint">
        {row.person.lastTouchAt ? relativeTime(row.person.lastTouchAt, now) : 'never'}
      </td>
      <td className="py-2.5 pr-4 font-mono text-[0.65rem] text-faint tabular-nums">
        {row.person.relationshipStrength}
      </td>
      <td className="py-2.5 pr-4 font-mono text-[0.65rem] whitespace-nowrap text-faint tabular-nums">
        {row.openOpportunities > 0
          ? `${String(row.openOpportunities)} · ${formatCurrencyCents(row.openValueCents)}`
          : '—'}
      </td>
      <td className="py-2.5 font-mono text-[0.65rem] text-faint">
        {row.person.tags.length > 0 ? row.person.tags.join(' · ') : '—'}
      </td>
    </tr>
  );
}

function CompanyRowView({ row, now }: { row: CompanyRow; now: Date }) {
  return (
    <tr className="border-b border-line/60 align-top last:border-b-0">
      <td className="py-2.5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={companyHref(row.company.id)} className="text-sm text-ivory hover:text-gold">
            {row.company.name}
          </Link>
          {row.company.source === 'demo' ? <DemoBadge /> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {[row.company.segment, row.company.domain].filter(Boolean).join(' · ')}
        </p>
      </td>
      <td className="py-2.5 pr-4 label-caps whitespace-nowrap text-faint">{row.company.status}</td>
      <td className="py-2.5 pr-4 font-mono text-[0.65rem] text-faint tabular-nums">
        {row.people.length}
      </td>
      <td className="py-2.5 pr-4 font-mono text-[0.65rem] whitespace-nowrap text-faint tabular-nums">
        {row.openOpportunities.length > 0
          ? `${String(row.openOpportunities.length)} · ${formatCurrencyCents(row.openValueCents)}`
          : '—'}
      </td>
      <td className="py-2.5 font-mono text-[0.65rem] whitespace-nowrap text-faint">
        {row.lastTouchAt ? relativeTime(row.lastTouchAt, now) : 'never'}
      </td>
    </tr>
  );
}

export function CrmPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const query = parseCrmQuery(searchParams);
  const counts = useMemo(() => crmCounts(dataset, now), [dataset, now]);
  const people = useMemo(() => selectPeople(dataset, query, now), [dataset, query, now]);
  const companies = useMemo(() => selectCompanies(dataset), [dataset]);

  function applyQuery(next: Partial<CrmQuery>) {
    const merged: CrmQuery = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.view !== 'people') params.set('view', merged.view);
    if (merged.temperature !== 'all') params.set('temperature', merged.temperature);
    setSearchParams(params);
  }

  const empty = query.view === 'people' ? people.length === 0 : companies.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Relationships</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">CRM</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          People and companies from the local store. Temperature is derived from the last recorded
          touch; relationship strength is the number written on the record. Neither is a prediction.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">People</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.people}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Companies</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.companies}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Dormant</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.dormant}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open pipeline</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              <Link to="/pipeline" className="hover:text-gold">
                {formatCurrencyCents(counts.openValueCents)}
              </Link>
            </dd>
          </div>
        </dl>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CRM_VIEWS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              applyQuery({ view: value });
            }}
            className={cn(
              filterButton,
              query.view === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {crmViewLabel[value]}
          </button>
        ))}

        {query.view === 'people' ? (
          <>
            <span className="mx-1 h-4 w-px bg-line" aria-hidden />
            {CRM_TEMPERATURES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  applyQuery({ temperature: value });
                }}
                className={cn(
                  filterButton,
                  query.temperature === value
                    ? 'border-gold/60 bg-gold-faint text-ivory'
                    : 'border-line text-faint hover:border-gold/40 hover:text-muted',
                )}
              >
                {temperatureLabel[value]}
              </button>
            ))}
          </>
        ) : null}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : empty ? (
        <p className="text-sm text-faint italic">
          {query.view === 'people'
            ? 'No people match this filter.'
            : 'The local store holds no companies.'}
        </p>
      ) : query.view === 'people' ? (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="label-caps pb-2 text-faint">Person</th>
              <th className="label-caps pb-2 text-faint">Temperature</th>
              <th className="label-caps pb-2 text-faint">Last touch</th>
              <th className="label-caps pb-2 text-faint">Strength</th>
              <th className="label-caps pb-2 text-faint">Open</th>
              <th className="label-caps pb-2 text-faint">Tags</th>
            </tr>
          </thead>
          <tbody>
            {people.map((row) => (
              <PersonRowView key={row.person.id} row={row} now={now} />
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="label-caps pb-2 text-faint">Company</th>
              <th className="label-caps pb-2 text-faint">Status</th>
              <th className="label-caps pb-2 text-faint">People</th>
              <th className="label-caps pb-2 text-faint">Open</th>
              <th className="label-caps pb-2 text-faint">Last touch</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((row) => (
              <CompanyRowView key={row.company.id} row={row} now={now} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

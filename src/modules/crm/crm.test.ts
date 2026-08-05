import { describe, expect, it } from 'vitest';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { DAY_MS } from '@/lib/clock';
import type { Person } from '@/domain';
import {
  companyIntelligence,
  crmCounts,
  daysSinceTouch,
  parseCrmQuery,
  relationshipIntelligence,
  relationshipTemperature,
  selectCompanies,
  selectPeople,
} from './crm';

const now = new Date('2026-08-05T07:30:00.000Z');
const dataset = buildDemoDataset(now);

function personTouchedDaysAgo(days: number | null): Person {
  const stamp = now.toISOString();
  return {
    id: 'p-test',
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    name: 'Test Person',
    role: '',
    relationshipStrength: 50,
    tags: [],
    notes: '',
    lastTouchAt: days === null ? undefined : new Date(now.getTime() - days * DAY_MS).toISOString(),
  };
}

describe('parseCrmQuery', () => {
  it('defaults to people and any temperature', () => {
    expect(parseCrmQuery(new URLSearchParams())).toEqual({ view: 'people', temperature: 'all' });
  });

  it('ignores values it does not serve', () => {
    const query = parseCrmQuery(new URLSearchParams('view=graph&temperature=lukewarm'));
    expect(query).toEqual({ view: 'people', temperature: 'all' });
  });

  it('reads a legal view and temperature from the URL', () => {
    expect(parseCrmQuery(new URLSearchParams('view=companies&temperature=dormant'))).toEqual({
      view: 'companies',
      temperature: 'dormant',
    });
  });
});

describe('relationshipTemperature', () => {
  it('bands on recency of contact alone', () => {
    expect(relationshipTemperature(personTouchedDaysAgo(0), now)).toBe('hot');
    expect(relationshipTemperature(personTouchedDaysAgo(3), now)).toBe('hot');
    expect(relationshipTemperature(personTouchedDaysAgo(7), now)).toBe('warm');
    expect(relationshipTemperature(personTouchedDaysAgo(14), now)).toBe('cooling');
    expect(relationshipTemperature(personTouchedDaysAgo(40), now)).toBe('dormant');
  });

  it('treats a person with no recorded touch as dormant, not as new', () => {
    expect(relationshipTemperature(personTouchedDaysAgo(null), now)).toBe('dormant');
    expect(daysSinceTouch(personTouchedDaysAgo(null), now)).toBeNull();
  });

  it('does not let a high strength score warm a cold relationship', () => {
    const strong = { ...personTouchedDaysAgo(45), relationshipStrength: 99 };
    expect(relationshipTemperature(strong, now)).toBe('dormant');
  });
});

describe('selectPeople', () => {
  it('opens with the coldest relationship first', () => {
    const rows = selectPeople(dataset, { view: 'people', temperature: 'all' }, now);
    expect(rows[0]?.person.id).toBe('p-santos');
    expect(rows.at(-1)?.person.id).toBe('p-rhodes');
  });

  it('filters to one temperature band', () => {
    const rows = selectPeople(dataset, { view: 'people', temperature: 'dormant' }, now);
    expect(rows.map((row) => row.person.id)).toEqual(['p-santos']);
  });

  it('attaches the open opportunities behind each person', () => {
    const dana = selectPeople(dataset, { view: 'people', temperature: 'all' }, now).find(
      (row) => row.person.id === 'p-aldridge',
    );
    expect(dana?.company?.name).toBe('TruOak Capital');
    expect(dana?.openOpportunities).toBe(1);
    expect(dana?.openValueCents).toBe(4_800_000);
  });

  it('returns nothing for an empty store', () => {
    expect(selectPeople(emptyDataset, { view: 'people', temperature: 'all' }, now)).toEqual([]);
  });
});

describe('selectCompanies', () => {
  it('ranks by open value and counts its people', () => {
    const rows = selectCompanies(dataset);
    expect(rows[0]?.company.id).toBe('co-truoak');
    expect(rows[0]?.people.map((person) => person.id)).toEqual(['p-aldridge']);
  });

  it('excludes closed opportunities from open value', () => {
    const closed: SovereignDataset = {
      ...dataset,
      opportunities: dataset.opportunities.map((opportunity) =>
        opportunity.companyId === 'co-truoak' ? { ...opportunity, stage: 'won' as const } : opportunity,
      ),
    };
    const truoak = selectCompanies(closed).find((row) => row.company.id === 'co-truoak');
    expect(truoak?.openValueCents).toBe(0);
  });
});

describe('relationshipIntelligence', () => {
  it('joins opportunities, tasks, and meetings around one person', () => {
    const intelligence = relationshipIntelligence(dataset, 'p-aldridge', now);
    expect(intelligence?.opportunities.map((row) => row.id)).toContain('opp-truoak');
    expect(intelligence?.tasks.map((row) => row.id)).toContain('t-brief-truoak');
    expect(intelligence?.meetings.map((row) => row.id)).toContain('mtg-truoak-renewal');
    expect(intelligence?.company?.id).toBe('co-truoak');
  });

  it('states the relationship in words that name their own evidence', () => {
    const intelligence = relationshipIntelligence(dataset, 'p-santos', now);
    expect(intelligence?.statement).toContain('Last recorded touch 26 days ago');
    expect(intelligence?.statement).toContain('open opportunity');
  });

  it('says so plainly when there has never been contact', () => {
    const untouched: SovereignDataset = {
      ...dataset,
      people: dataset.people.map((person) =>
        person.id === 'p-santos' ? { ...person, lastTouchAt: undefined } : person,
      ),
    };
    expect(relationshipIntelligence(untouched, 'p-santos', now)?.statement).toBe(
      'No contact has ever been recorded with this person.',
    );
  });

  it('sorts open tasks ahead of completed ones', () => {
    const intelligence = relationshipIntelligence(dataset, 'p-aldridge', now);
    const statuses = intelligence?.tasks.map((task) => task.status) ?? [];
    const firstDone = statuses.indexOf('done');
    if (firstDone >= 0) {
      expect(statuses.slice(firstDone).every((status) => status === 'done')).toBe(true);
    }
  });

  it('returns null for an id the store does not hold', () => {
    expect(relationshipIntelligence(dataset, 'p-nobody', now)).toBeNull();
  });
});

describe('companyIntelligence', () => {
  it('gathers the account: people, opportunities, tasks, meetings', () => {
    const intelligence = companyIntelligence(dataset, 'co-truoak', now);
    expect(intelligence?.people.map((row) => row.person.id)).toEqual(['p-aldridge']);
    expect(intelligence?.opportunities.map((row) => row.id)).toEqual(['opp-truoak']);
    expect(intelligence?.openValueCents).toBe(4_800_000);
    expect(intelligence?.tasks.length).toBeGreaterThan(0);
    expect(intelligence?.meetings.map((row) => row.id)).toContain('mtg-truoak-renewal');
  });

  it('returns null for an unknown company', () => {
    expect(companyIntelligence(dataset, 'co-nobody', now)).toBeNull();
  });
});

describe('crmCounts', () => {
  it('counts people, companies, dormant relationships, and open value', () => {
    const counts = crmCounts(dataset, now);
    expect(counts.people).toBe(dataset.people.length);
    expect(counts.companies).toBe(dataset.companies.length);
    expect(counts.dormant).toBe(1);
    expect(counts.openValueCents).toBeGreaterThan(0);
  });

  it('reports zero everywhere for an empty store', () => {
    expect(crmCounts(emptyDataset, now)).toEqual({
      people: 0,
      companies: 0,
      dormant: 0,
      openValueCents: 0,
    });
  });
});

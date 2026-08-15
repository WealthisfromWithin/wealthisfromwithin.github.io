import type { SovereignDataset } from '@/data/dataset';
import type { Company, Meeting, Opportunity, Person, Task } from '@/domain';
import { DAY_MS } from '@/lib/clock';
import { isOpenStage } from '@/modules/pipeline/pipeline';

export const CRM_VIEWS = ['people', 'companies'] as const;
export type CrmView = (typeof CRM_VIEWS)[number];

/**
 * Temperature is derived from **recency of contact only**. Relationship strength
 * is a separate stored number and is shown separately: blending the two would
 * produce a score no record actually holds.
 */
export const CRM_TEMPERATURES = ['all', 'hot', 'warm', 'cooling', 'dormant'] as const;
export type CrmTemperatureFilter = (typeof CRM_TEMPERATURES)[number];
export type Temperature = Exclude<CrmTemperatureFilter, 'all'>;

export const temperatureLabel: Record<CrmTemperatureFilter, string> = {
  all: 'Any temperature',
  hot: 'Hot',
  warm: 'Warm',
  cooling: 'Cooling',
  dormant: 'Dormant',
};

export const temperatureTone: Record<Temperature, 'critical' | 'warning' | 'info' | 'muted'> = {
  hot: 'info',
  warm: 'info',
  cooling: 'warning',
  dormant: 'critical',
};

const TEMPERATURE_DAYS: readonly { max: number; value: Temperature }[] = [
  { max: 3, value: 'hot' },
  { max: 10, value: 'warm' },
  { max: 21, value: 'cooling' },
];

export const crmViewLabel: Record<CrmView, string> = {
  people: 'People',
  companies: 'Companies',
};

export interface CrmQuery {
  view: CrmView;
  temperature: CrmTemperatureFilter;
}

export const defaultCrmQuery: CrmQuery = { view: 'people', temperature: 'all' };

export function parseCrmQuery(params: URLSearchParams): CrmQuery {
  const view = params.get('view');
  const temperature = params.get('temperature');
  return {
    view: CRM_VIEWS.find((value) => value === view) ?? defaultCrmQuery.view,
    temperature:
      CRM_TEMPERATURES.find((value) => value === temperature) ?? defaultCrmQuery.temperature,
  };
}

/** Whole days since the last recorded touch, or `null` when there has never been one. */
export function daysSinceTouch(person: Person, now: Date): number | null {
  if (person.lastTouchAt === undefined) return null;
  const touched = Date.parse(person.lastTouchAt);
  if (Number.isNaN(touched)) return null;
  return Math.floor((now.getTime() - touched) / DAY_MS);
}

export function relationshipTemperature(person: Person, now: Date): Temperature {
  const days = daysSinceTouch(person, now);
  if (days === null) return 'dormant';
  return TEMPERATURE_DAYS.find((band) => days <= band.max)?.value ?? 'dormant';
}

export interface PersonRow {
  person: Person;
  company: Company | undefined;
  temperature: Temperature;
  days: number | null;
  openOpportunities: number;
  openValueCents: number;
}

export interface CompanyRow {
  company: Company;
  people: Person[];
  openOpportunities: Opportunity[];
  openValueCents: number;
  lastTouchAt: string | undefined;
}

function openOpportunitiesFor(dataset: SovereignDataset, person: Person): Opportunity[] {
  return dataset.opportunities.filter(
    (opportunity) =>
      isOpenStage(opportunity.stage) &&
      (opportunity.personId === person.id ||
        (opportunity.personId === undefined && opportunity.companyId === person.companyId)),
  );
}

function sumValue(opportunities: readonly Opportunity[]): number {
  return opportunities.reduce((total, opportunity) => total + opportunity.valueCents, 0);
}

/** Coldest first: the list exists to surface relationships going quiet. */
export function selectPeople(
  dataset: SovereignDataset,
  query: CrmQuery = defaultCrmQuery,
  now: Date = new Date(),
): PersonRow[] {
  return dataset.people
    .map((person) => {
      const open = openOpportunitiesFor(dataset, person);
      return {
        person,
        company: dataset.companies.find((company) => company.id === person.companyId),
        temperature: relationshipTemperature(person, now),
        days: daysSinceTouch(person, now),
        openOpportunities: open.length,
        openValueCents: sumValue(open),
      };
    })
    .filter((row) => query.temperature === 'all' || row.temperature === query.temperature)
    .sort((a, b) => (b.days ?? Number.MAX_SAFE_INTEGER) - (a.days ?? Number.MAX_SAFE_INTEGER));
}

/** Largest open value first: the list is a revenue view of the account base. */
export function selectCompanies(dataset: SovereignDataset): CompanyRow[] {
  return dataset.companies
    .map((company) => {
      const people = dataset.people.filter((person) => person.companyId === company.id);
      const openOpportunities = dataset.opportunities.filter(
        (opportunity) => opportunity.companyId === company.id && isOpenStage(opportunity.stage),
      );
      const touches = people
        .map((person) => person.lastTouchAt)
        .filter((value): value is string => value !== undefined)
        .sort((a, b) => Date.parse(b) - Date.parse(a));

      return {
        company,
        people,
        openOpportunities,
        openValueCents: sumValue(openOpportunities),
        lastTouchAt: touches[0],
      };
    })
    .sort((a, b) => b.openValueCents - a.openValueCents || a.company.name.localeCompare(b.company.name));
}

export interface CrmCounts {
  people: number;
  companies: number;
  dormant: number;
  openValueCents: number;
}

export function crmCounts(dataset: SovereignDataset, now: Date): CrmCounts {
  return {
    people: dataset.people.length,
    companies: dataset.companies.length,
    dormant: dataset.people.filter((person) => relationshipTemperature(person, now) === 'dormant')
      .length,
    openValueCents: sumValue(dataset.opportunities.filter((row) => isOpenStage(row.stage))),
  };
}

/**
 * Relationship intelligence is a **local join**, not a model: the tasks,
 * opportunities, and meetings already in the store, gathered around one person.
 */
export interface PersonIntelligence {
  person: Person;
  company: Company | undefined;
  temperature: Temperature;
  days: number | null;
  opportunities: Opportunity[];
  tasks: Task[];
  meetings: Meeting[];
  statement: string;
}

function plural(count: number, singular: string, many = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : many}`;
}

function byStartDescending(a: Meeting, b: Meeting): number {
  return Date.parse(b.startsAt) - Date.parse(a.startsAt);
}

function relatedTasks(
  dataset: SovereignDataset,
  match: (task: Task) => boolean,
): Task[] {
  return dataset.tasks.filter(match).sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'done') return 1;
      if (b.status === 'done') return -1;
    }
    return (
      (a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER) -
      (b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER)
    );
  });
}

export function relationshipIntelligence(
  dataset: SovereignDataset,
  personId: string,
  now: Date,
): PersonIntelligence | null {
  const person = dataset.people.find((row) => row.id === personId);
  if (!person) return null;

  const opportunities = dataset.opportunities
    .filter(
      (opportunity) =>
        opportunity.personId === person.id ||
        (person.companyId !== undefined && opportunity.companyId === person.companyId),
    )
    .sort((a, b) => b.valueCents - a.valueCents);

  const opportunityIds = new Set(opportunities.map((opportunity) => opportunity.id));
  const tasks = relatedTasks(
    dataset,
    (task) =>
      task.personId === person.id ||
      (task.opportunityId !== undefined && opportunityIds.has(task.opportunityId)),
  );

  const meetings = dataset.meetings
    .filter((meeting) => meeting.personIds.includes(person.id))
    .sort(byStartDescending);

  const days = daysSinceTouch(person, now);
  const openOpportunities = opportunities.filter((row) => isOpenStage(row.stage)).length;
  const openTasks = tasks.filter((task) => task.status !== 'done').length;

  const statement =
    days === null
      ? 'No contact has ever been recorded with this person.'
      : [
          `Last recorded touch ${plural(days, 'day')} ago`,
          `${plural(openOpportunities, 'open opportunity', 'open opportunities')} attached`,
          `${plural(openTasks, 'open task')} outstanding`,
        ].join(' · ');

  return {
    person,
    company: dataset.companies.find((row) => row.id === person.companyId),
    temperature: relationshipTemperature(person, now),
    days,
    opportunities,
    tasks,
    meetings,
    statement,
  };
}

export interface CompanyIntelligence {
  company: Company;
  people: PersonRow[];
  opportunities: Opportunity[];
  openValueCents: number;
  tasks: Task[];
  meetings: Meeting[];
}

export function companyIntelligence(
  dataset: SovereignDataset,
  companyId: string,
  now: Date,
): CompanyIntelligence | null {
  const company = dataset.companies.find((row) => row.id === companyId);
  if (!company) return null;

  const people = selectPeople(dataset, defaultCrmQuery, now).filter(
    (row) => row.person.companyId === company.id,
  );
  const opportunities = dataset.opportunities
    .filter((opportunity) => opportunity.companyId === company.id)
    .sort((a, b) => b.valueCents - a.valueCents);
  const opportunityIds = new Set(opportunities.map((opportunity) => opportunity.id));
  const personIds = new Set(people.map((row) => row.person.id));

  return {
    company,
    people,
    opportunities,
    openValueCents: sumValue(opportunities.filter((row) => isOpenStage(row.stage))),
    tasks: relatedTasks(
      dataset,
      (task) =>
        (task.opportunityId !== undefined && opportunityIds.has(task.opportunityId)) ||
        (task.personId !== undefined && personIds.has(task.personId)),
    ),
    meetings: dataset.meetings
      .filter(
        (meeting) =>
          meeting.companyId === company.id ||
          meeting.personIds.some((id) => personIds.has(id)),
      )
      .sort(byStartDescending),
  };
}

import { integrationCatalog } from '@/integrations/catalog';
import { DAY_MS, HOUR_MS } from '@/lib/clock';
import type { SovereignDataset } from './dataset';

/** Seed contents are versioned so a shape change reseeds the local demo rows. */
export const SEED_VERSION = 'wave2.0';

const DEMO = 'demo' as const;

function at(now: Date, offsetMs: number): string {
  return new Date(now.getTime() + offsetMs).toISOString();
}

function todayAt(now: Date, hour: number, minute = 0): string {
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/**
 * Demo dataset. Every row carries `source: 'demo'` and the UI badges it.
 * Timestamps are relative to `now` so the Morning Brief stays legible whenever
 * the surface is opened.
 */
export function buildDemoDataset(now: Date): SovereignDataset {
  const stamp = now.toISOString();
  const base = { source: DEMO, createdAt: stamp, updatedAt: stamp };

  const companies: SovereignDataset['companies'] = [
    { ...base, id: 'co-truoak', name: 'TruOak Capital', segment: 'Wealth advisory', domain: 'truoak.example' },
    { ...base, id: 'co-meridian', name: 'Meridian Wealth', segment: 'RIA', domain: 'meridian.example' },
    { ...base, id: 'co-harbour', name: 'Harbour & Vale', segment: 'Family office', domain: 'harbourvale.example' },
    { ...base, id: 'co-kestrel', name: 'Kestrel Advisory', segment: 'Boutique planning', domain: 'kestrel.example' },
  ];

  const people: SovereignDataset['people'] = [
    {
      ...base,
      id: 'p-aldridge',
      name: 'Dana Aldridge',
      role: 'Managing Partner',
      companyId: 'co-truoak',
      email: 'dana@truoak.example',
      relationshipStrength: 78,
      lastTouchAt: at(now, -3 * DAY_MS),
      tags: ['champion', 'renewal'],
    },
    {
      ...base,
      id: 'p-okafor',
      name: 'Emeka Okafor',
      role: 'Head of Growth',
      companyId: 'co-meridian',
      email: 'emeka@meridian.example',
      relationshipStrength: 54,
      lastTouchAt: at(now, -11 * DAY_MS),
      tags: ['economic-buyer'],
    },
    {
      ...base,
      id: 'p-rhodes',
      name: 'Priya Rhodes',
      role: 'Chief of Staff',
      companyId: 'co-harbour',
      email: 'priya@harbourvale.example',
      relationshipStrength: 66,
      lastTouchAt: at(now, -1 * DAY_MS),
      tags: ['gatekeeper'],
    },
    {
      ...base,
      id: 'p-santos',
      name: 'Iris Santos',
      role: 'Operations Lead',
      companyId: 'co-kestrel',
      email: 'iris@kestrel.example',
      relationshipStrength: 41,
      lastTouchAt: at(now, -26 * DAY_MS),
      tags: ['dormant'],
    },
  ];

  const missions: SovereignDataset['missions'] = [
    {
      ...base,
      id: 'msn-042',
      code: 'MSN-042',
      title: 'Compound the advisory funnel',
      objective: 'Move qualified advisory conversations from 3/week to 8/week without new spend.',
      status: 'active',
      progress: 46,
    },
    {
      ...base,
      id: 'msn-043',
      code: 'MSN-043',
      title: 'Automate publishing substrate',
      objective: 'Publish to three channels from one approved source with a human gate.',
      status: 'blocked',
      progress: 28,
      blockedReason: 'n8n credentials are not configured for the Command Surface.',
    },
    {
      ...base,
      id: 'msn-044',
      code: 'MSN-044',
      title: 'Institutional memory',
      objective: 'Every decision recorded with rationale and reversal cost.',
      status: 'paused',
      progress: 8,
    },
  ];

  const tasks: SovereignDataset['tasks'] = [
    {
      ...base,
      id: 't-brief-truoak',
      title: 'Send TruOak renewal framing memo',
      status: 'todo',
      priority: 'critical',
      dueAt: todayAt(now, 11),
      missionId: 'msn-042',
      estimateMinutes: 45,
      context: 'Dana asked for the compounding model before her partner meeting.',
    },
    {
      ...base,
      id: 't-meridian-call',
      title: 'Prep Meridian discovery call',
      status: 'in_progress',
      priority: 'high',
      dueAt: todayAt(now, 15),
      missionId: 'msn-042',
      estimateMinutes: 30,
      context: 'Second call. Needs the pipeline-stage doctrine one-pager.',
    },
    {
      ...base,
      id: 't-publish-loop',
      title: 'Wire publishing loop to approval gate',
      status: 'blocked',
      priority: 'high',
      dueAt: at(now, 2 * DAY_MS),
      blockedReason: 'Waiting on n8n credentials — integration is Awaiting Credentials.',
      blockedSince: at(now, -6 * DAY_MS),
      missionId: 'msn-043',
      context: 'Blocked at the integration boundary, not the code.',
    },
    {
      ...base,
      id: 't-decision-log',
      title: 'Draft decision log schema',
      status: 'blocked',
      priority: 'normal',
      blockedReason: 'Awaiting architecture gate G3 before Wave 5 scope opens.',
      blockedSince: at(now, -2 * DAY_MS),
      missionId: 'msn-044',
      context: 'Do not start before the gate.',
    },
    {
      ...base,
      id: 't-harbour-followup',
      title: 'Follow up with Harbour & Vale on scope',
      status: 'todo',
      priority: 'high',
      dueAt: todayAt(now, 17),
      estimateMinutes: 20,
      context: 'Priya expects a scope note today.',
    },
    {
      ...base,
      id: 't-overdue-audit',
      title: 'Close out Q3 content audit',
      status: 'todo',
      priority: 'normal',
      dueAt: at(now, -2 * DAY_MS),
      estimateMinutes: 60,
      context: 'Overdue. Blocking the learning cycle report.',
    },
    {
      ...base,
      id: 't-kestrel-reengage',
      title: 'Re-engage Kestrel Advisory',
      status: 'todo',
      priority: 'low',
      dueAt: at(now, 5 * DAY_MS),
      estimateMinutes: 15,
      context: 'Dormant 26 days.',
    },
    {
      ...base,
      id: 't-shipped-shell',
      title: 'Ship command shell foundation',
      status: 'done',
      priority: 'high',
      missionId: 'msn-042',
      context: 'Wave 1 scaffold.',
    },
  ];

  const approvals: SovereignDataset['approvals'] = [
    {
      ...base,
      id: 'apr-linkedin',
      title: 'Publish "The Compounding Constraint" to LinkedIn',
      requestedBy: 'Content loop',
      kind: 'content',
      risk: 'warning',
      status: 'pending',
      summary: 'Customer-facing copy. WITHIN constitution requires a human gate.',
      dueAt: todayAt(now, 13),
    },
    {
      ...base,
      id: 'apr-outreach',
      title: 'Send 12-contact re-engagement sequence',
      requestedBy: 'Pipeline loop',
      kind: 'outreach',
      risk: 'critical',
      status: 'pending',
      summary: 'Outbound to dormant contacts. Compliance review required.',
      dueAt: at(now, 1 * DAY_MS),
    },
    {
      ...base,
      id: 'apr-automation',
      title: 'Enable nightly lead-scoring automation',
      requestedBy: 'Automation loop',
      kind: 'automation',
      risk: 'info',
      status: 'pending',
      summary: 'Read-only scoring pass. No customer contact.',
    },
    {
      ...base,
      id: 'apr-spend',
      title: 'Renew the transcription seat',
      requestedBy: 'Operations loop',
      kind: 'spend',
      risk: 'info',
      status: 'approved',
      summary: '$18/month. Cleared last week; kept here as decided history.',
      decidedAt: at(now, -5 * DAY_MS),
      decidedBy: 'Operator',
    },
    {
      ...base,
      id: 'apr-access',
      title: 'Grant the research agent read access to the CRM export',
      requestedBy: 'Research loop',
      kind: 'access',
      risk: 'critical',
      status: 'rejected',
      summary: 'Refused: no credential vault exists on this surface yet.',
      decidedAt: at(now, -2 * DAY_MS),
      decidedBy: 'Operator',
    },
  ];

  const opportunities: SovereignDataset['opportunities'] = [
    {
      ...base,
      id: 'opp-truoak',
      name: 'TruOak advisory retainer renewal',
      companyId: 'co-truoak',
      stage: 'negotiation',
      valueCents: 4_800_000,
      probability: 72,
      nextStep: 'Send renewal framing memo',
      nextStepAt: todayAt(now, 11),
      signal: 'Champion asked for pricing rationale unprompted.',
    },
    {
      ...base,
      id: 'opp-meridian',
      name: 'Meridian growth engagement',
      companyId: 'co-meridian',
      stage: 'qualified',
      valueCents: 3_200_000,
      probability: 45,
      nextStep: 'Discovery call two',
      nextStepAt: todayAt(now, 15),
      signal: 'Opened the pipeline doctrine three times this week.',
    },
    {
      ...base,
      id: 'opp-harbour',
      name: 'Harbour & Vale content system',
      companyId: 'co-harbour',
      stage: 'proposal',
      valueCents: 2_100_000,
      probability: 55,
      nextStep: 'Scope note',
      nextStepAt: todayAt(now, 17),
      signal: 'Chief of staff forwarded the proposal internally.',
    },
    {
      ...base,
      id: 'opp-kestrel',
      name: 'Kestrel operations audit',
      companyId: 'co-kestrel',
      stage: 'engaged',
      valueCents: 900_000,
      probability: 20,
      nextStep: 'Re-engagement note',
      nextStepAt: at(now, 5 * DAY_MS),
      signal: 'Dormant since the last audit cycle.',
    },
  ];

  const contentItems: SovereignDataset['contentItems'] = [
    {
      ...base,
      id: 'c-constraint',
      title: 'The Compounding Constraint',
      status: 'review',
      channel: 'LinkedIn',
      scheduledFor: todayAt(now, 13),
    },
    {
      ...base,
      id: 'c-substrate',
      title: 'Why your stack is not a system',
      status: 'drafting',
      channel: 'Newsletter',
      scheduledFor: at(now, 3 * DAY_MS),
    },
    {
      ...base,
      id: 'c-quiet-ops',
      title: 'Quiet operations: the anti-dashboard',
      status: 'blocked',
      channel: 'Newsletter',
      blockedReason: 'Publishing webhook has no credentials.',
    },
    {
      ...base,
      id: 'c-idea-leverage',
      title: 'Leverage inventory: what actually compounds',
      status: 'idea',
      channel: 'Long form',
    },
  ];

  const notifications: SovereignDataset['notifications'] = [
    {
      ...base,
      id: 'n-approval-outreach',
      title: 'Outreach sequence needs approval',
      body: '12 dormant contacts queued. Compliance gate is open.',
      severity: 'critical',
      read: false,
      origin: 'Approval queue',
      href: '/approvals',
    },
    {
      ...base,
      id: 'n-truoak',
      title: 'TruOak opened the renewal memo twice',
      body: 'Buying signal on a $48k negotiation.',
      severity: 'info',
      read: false,
      origin: 'Pipeline',
    },
    {
      ...base,
      id: 'n-credentials',
      title: 'Publishing automation cannot run',
      body: 'The n8n connector is still awaiting credentials, so the loop skips its run.',
      severity: 'warning',
      read: false,
      origin: 'Health monitor',
      href: '/health',
    },
    {
      ...base,
      id: 'n-content-review',
      title: '"The Compounding Constraint" is waiting on a human gate',
      body: 'Drafted and queued for LinkedIn. Nothing publishes without approval.',
      severity: 'info',
      read: false,
      origin: 'Content loop',
      href: '/approvals',
    },
    {
      ...base,
      id: 'n-kestrel',
      title: 'Kestrel Advisory has been dormant 26 days',
      body: 'Relationship strength dropped below the re-engagement threshold.',
      severity: 'info',
      read: false,
      origin: 'Relationship watch',
    },
    {
      ...base,
      id: 'n-digest',
      title: 'Weekly learning digest ready',
      body: 'Content performance summary generated.',
      severity: 'info',
      read: true,
      readAt: at(now, -18 * HOUR_MS),
      origin: 'Content loop',
    },
    {
      ...base,
      id: 'n-seed-refresh',
      title: 'Demo seed refreshed',
      body: 'Timestamps were rebuilt against the current time so the brief stays legible.',
      severity: 'info',
      read: true,
      readAt: at(now, -30 * HOUR_MS),
      origin: 'Local store',
      href: '/settings',
    },
  ];

  const events: SovereignDataset['events'] = [
    {
      ...base,
      id: 'e-truoak-open',
      at: at(now, -3 * HOUR_MS),
      title: 'TruOak reopened the renewal memo',
      detail: 'Second view in 12 hours.',
      channel: 'pipeline',
    },
    {
      ...base,
      id: 'e-content-review',
      at: at(now, -7 * HOUR_MS),
      title: '"The Compounding Constraint" moved to review',
      detail: 'Awaiting human approval before publish.',
      channel: 'content',
    },
    {
      ...base,
      id: 'e-automation-skip',
      at: at(now, -9 * HOUR_MS),
      title: 'Publishing automation skipped its run',
      detail: 'n8n webhook URL missing. Skipped honestly instead of failing silently.',
      channel: 'automation',
    },
    {
      ...base,
      id: 'e-harbour-forward',
      at: at(now, -14 * HOUR_MS),
      title: 'Harbour & Vale forwarded the proposal internally',
      detail: 'Three new readers on the document.',
      channel: 'pipeline',
    },
    {
      ...base,
      id: 'e-shell',
      at: at(now, -20 * HOUR_MS),
      title: 'Command shell foundation deployed',
      detail: 'Wave 1 scaffold replaced the static poster.',
      channel: 'system',
    },
    {
      ...base,
      id: 'e-stale',
      at: at(now, -4 * DAY_MS),
      title: 'Quarterly pipeline review closed',
      detail: 'Outside the overnight window.',
      channel: 'system',
    },
  ];

  const metrics: SovereignDataset['metrics'] = [
    {
      ...base,
      id: 'm-hours-reclaimed',
      label: 'Hours reclaimed by automation',
      value: 6.5,
      unit: 'hours',
      deltaPercent: 18,
      window: '7d',
      origin: 'Content loop + scheduling',
    },
    {
      ...base,
      id: 'm-pipeline-velocity',
      label: 'Pipeline value in motion',
      value: 110_000,
      unit: 'usd',
      deltaPercent: 12,
      window: '30d',
      origin: 'Opportunities in qualified+',
    },
    {
      ...base,
      id: 'm-approval-latency',
      label: 'Approval latency',
      value: 41,
      unit: 'percent',
      deltaPercent: -22,
      window: '14d',
      origin: 'Approval queue',
    },
    {
      ...base,
      id: 'm-published',
      label: 'Assets published per week',
      value: 4,
      unit: 'count',
      deltaPercent: 0,
      window: '7d',
      origin: 'Content engine',
    },
  ];

  // Integration rows are baseline configuration, not fabricated telemetry: their
  // states are literally true, so they are `local` and carry no demo badge.
  const integrations: SovereignDataset['integrations'] = integrationCatalog.map((entry) => ({
    ...base,
    source: 'local' as const,
    id: entry.id,
    name: entry.name,
    category: entry.category,
    state: entry.state,
    capabilities: [...entry.capabilities],
    rationale: entry.rationale,
    substrate: entry.substrate ?? false,
  }));

  return {
    companies,
    people,
    missions,
    tasks,
    approvals,
    opportunities,
    contentItems,
    notifications,
    events,
    metrics,
    integrations,
  };
}

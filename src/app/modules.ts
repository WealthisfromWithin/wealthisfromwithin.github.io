import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  Brain,
  CalendarDays,
  ChartColumn,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  Inbox,
  Layers,
  ListChecks,
  NotebookPen,
  Plug,
  Radar,
  ScrollText,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';

export type ModuleGroup = 'commander' | 'operator';

/**
 * `enabled` modules are routed and shown in nav. `planned` modules have no
 * route and never appear in nav — the audit forbids "coming soon" pages
 * (ARCHITECTURE_AUDIT §5.3). They are listed in Settings as a roadmap only.
 */
export type ModuleStatus = 'enabled' | 'planned';

export interface ModuleDefinition {
  id: string;
  path: string;
  label: string;
  group: ModuleGroup;
  status: ModuleStatus;
  wave: number;
  summary: string;
  icon: LucideIcon;
}

export const moduleRegistry: readonly ModuleDefinition[] = [
  {
    id: 'brief',
    path: '/',
    label: 'Morning Brief',
    group: 'commander',
    status: 'enabled',
    wave: 1,
    summary: 'The six questions, answered from the local store.',
    icon: Gauge,
  },
  {
    id: 'approvals',
    path: '/approvals',
    label: 'Approval Queue',
    group: 'commander',
    status: 'enabled',
    wave: 2,
    summary: 'Human gates. Approve or reject; the decision persists locally.',
    icon: ShieldCheck,
  },
  {
    id: 'health',
    path: '/health',
    label: 'Health Monitor',
    group: 'commander',
    status: 'enabled',
    wave: 2,
    summary: 'Substrate truth derived from the integration registry. No probes yet.',
    icon: Activity,
  },
  {
    id: 'inbox',
    path: '/inbox',
    label: 'Inbox',
    group: 'operator',
    status: 'enabled',
    wave: 2,
    summary: 'Every signal the local store holds, unread first.',
    icon: Inbox,
  },
  {
    id: 'crm',
    path: '/crm',
    label: 'CRM',
    group: 'operator',
    status: 'enabled',
    wave: 3,
    summary: 'People and companies, with the relationship read from local joins.',
    icon: Users,
  },
  {
    id: 'pipeline',
    path: '/pipeline',
    label: 'Pipeline',
    group: 'operator',
    status: 'enabled',
    wave: 3,
    summary: 'Opportunities by stage, weighted by the probability on the record.',
    icon: TrendingUp,
  },
  {
    id: 'tasks',
    path: '/tasks',
    label: 'Tasks',
    group: 'operator',
    status: 'enabled',
    wave: 3,
    summary: 'Execution across projects. Status changes persist locally.',
    icon: ListChecks,
  },
  {
    id: 'projects',
    path: '/projects',
    label: 'Projects',
    group: 'operator',
    status: 'enabled',
    wave: 3,
    summary: 'The work tasks belong to, with progress counted from those tasks.',
    icon: FolderKanban,
  },
  {
    id: 'calendar',
    path: '/calendar',
    label: 'Calendar',
    group: 'operator',
    status: 'enabled',
    wave: 3,
    summary: 'One week of meetings and due work, in one agenda.',
    icon: CalendarDays,
  },
  {
    id: 'meetings',
    path: '/meetings',
    label: 'Meetings',
    group: 'operator',
    status: 'enabled',
    wave: 3,
    summary: 'Meeting records and the notes the operator wrote about them.',
    icon: NotebookPen,
  },
  {
    id: 'integrations',
    path: '/integrations',
    label: 'Integrations',
    group: 'operator',
    status: 'enabled',
    wave: 1,
    summary: 'Connected, Disabled, or Awaiting Credentials. Nothing else.',
    icon: Plug,
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    group: 'operator',
    status: 'enabled',
    wave: 1,
    summary: 'Surface preferences, local store control, roadmap.',
    icon: Settings,
  },

  // Mission Control is not one of the audit's Wave 3 items (§7 lists CRM,
  // Pipeline, Tasks/Projects, Calendar/Meetings). It waits for the objective and
  // prediction work it actually needs rather than shipping as a mission list.
  { id: 'missions', path: '/missions', label: 'Mission Control', group: 'commander', status: 'planned', wave: 6, summary: 'Objectives, agents, predictions.', icon: Target },
  { id: 'content', path: '/content', label: 'Content OS', group: 'operator', status: 'planned', wave: 4, summary: 'Idea vault through publishing analytics.', icon: FileText },
  { id: 'knowledge', path: '/knowledge', label: 'Knowledge', group: 'operator', status: 'planned', wave: 5, summary: 'Memory, documents, compounding context.', icon: Brain },
  { id: 'research', path: '/research', label: 'Research', group: 'operator', status: 'planned', wave: 5, summary: 'External signal capture.', icon: Radar },
  { id: 'ai', path: '/ai', label: 'AI Workspace', group: 'operator', status: 'planned', wave: 5, summary: 'Prompt library and kernel sessions.', icon: Bot },
  { id: 'decisions', path: '/decisions', label: 'Decision Log', group: 'commander', status: 'planned', wave: 5, summary: 'Institutional memory of choices.', icon: ScrollText },
  { id: 'automations', path: '/automations', label: 'Automations', group: 'operator', status: 'planned', wave: 6, summary: 'Workflow leverage with approval gates.', icon: Workflow },
  { id: 'metrics', path: '/metrics', label: 'Business Metrics', group: 'commander', status: 'planned', wave: 6, summary: 'Financial KPIs and leverage proof.', icon: ChartColumn },
  { id: 'analytics', path: '/analytics', label: 'Analytics', group: 'operator', status: 'planned', wave: 6, summary: 'Learning loop reporting.', icon: Layers },
  { id: 'sync', path: '/sync', label: 'Command API Sync', group: 'operator', status: 'planned', wave: 7, summary: 'Remote read-model and write-through.', icon: Database },
] as const;

/**
 * Record detail routes. A module may serve exactly the patterns listed here and
 * nothing else: the router builds its children from this table and
 * `isSafeInternalHref` validates record links against the same table, so a link
 * to a detail page cannot outlive the route that serves it.
 */
export interface RecordRouteDefinition {
  id: string;
  moduleId: string;
  /** Router path carrying a single `:id` segment. */
  pattern: string;
}

export const recordRoutes: readonly RecordRouteDefinition[] = [
  { id: 'crm-person', moduleId: 'crm', pattern: '/crm/person/:id' },
  { id: 'crm-company', moduleId: 'crm', pattern: '/crm/company/:id' },
  { id: 'pipeline-opportunity', moduleId: 'pipeline', pattern: '/pipeline/opportunity/:id' },
] as const;

export function enabledModules(): ModuleDefinition[] {
  return moduleRegistry.filter((module) => module.status === 'enabled');
}

/** Detail routes whose owning module is enabled. Planned modules serve nothing. */
export function enabledRecordRoutes(): RecordRouteDefinition[] {
  const enabled = new Set(enabledModules().map((module) => module.id));
  return recordRoutes.filter((route) => enabled.has(route.moduleId));
}

export function plannedModules(): ModuleDefinition[] {
  return moduleRegistry
    .filter((module) => module.status === 'planned')
    .sort((a, b) => a.wave - b.wave || a.label.localeCompare(b.label));
}

export function modulesByGroup(group: ModuleGroup): ModuleDefinition[] {
  return enabledModules().filter((module) => module.group === group);
}

export function findModuleByPath(path: string): ModuleDefinition | undefined {
  return moduleRegistry.find((module) => module.path === path);
}

export const groupLabel: Record<ModuleGroup, string> = {
  commander: 'Commander',
  operator: 'Operator',
};

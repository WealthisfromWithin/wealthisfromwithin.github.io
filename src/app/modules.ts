import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  Brain,
  CalendarDays,
  ChartColumn,
  Database,
  FileStack,
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
  Sparkles,
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
    id: 'missions',
    path: '/missions',
    label: 'Mission Control',
    group: 'commander',
    status: 'enabled',
    wave: 6,
    summary: 'Objectives, and the local work that actually serves them.',
    icon: Target,
  },
  {
    id: 'metrics',
    path: '/metrics',
    label: 'Business Metrics',
    group: 'commander',
    status: 'enabled',
    wave: 6,
    summary: 'Financial KPIs counted from the local domain. No finance API is called.',
    icon: ChartColumn,
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
    id: 'content',
    path: '/content',
    label: 'Content OS',
    group: 'operator',
    status: 'enabled',
    wave: 4,
    summary: 'Idea vault through publishing analytics. Publishing is recorded, not performed.',
    icon: FileText,
  },
  {
    id: 'decisions',
    path: '/decisions',
    label: 'Decision Log',
    group: 'commander',
    status: 'enabled',
    wave: 5,
    summary: 'Choices with their rationale, and the ones still waiting on a call.',
    icon: ScrollText,
  },
  {
    id: 'knowledge',
    path: '/knowledge',
    label: 'Knowledge',
    group: 'operator',
    status: 'enabled',
    wave: 5,
    summary: 'What the operation knows, linked to the records it is about.',
    icon: Brain,
  },
  {
    id: 'memory',
    path: '/memory',
    label: 'Memory',
    group: 'operator',
    status: 'enabled',
    wave: 5,
    summary: 'Durable facts, preferences, and constraints, with review dates.',
    icon: Sparkles,
  },
  {
    id: 'documents',
    path: '/documents',
    label: 'Documents',
    group: 'operator',
    status: 'enabled',
    wave: 5,
    summary: 'Local documents, rendered as text. Nothing is uploaded or hosted.',
    icon: FileStack,
  },
  {
    id: 'research',
    path: '/research',
    label: 'Research',
    group: 'operator',
    status: 'enabled',
    wave: 5,
    summary: 'Open questions and the findings recorded by hand against them.',
    icon: Radar,
  },
  {
    id: 'ai',
    path: '/ai',
    label: 'AI Workspace',
    group: 'operator',
    status: 'enabled',
    wave: 5,
    summary: 'Sessions against the Agent Kernel. It refuses rather than pretends.',
    icon: Bot,
  },
  {
    id: 'prompts',
    path: '/prompts',
    label: 'Prompt Library',
    group: 'operator',
    status: 'enabled',
    wave: 5,
    summary: 'Reusable instructions. Browsable and editable with no provider at all.',
    icon: NotebookPen,
  },
  {
    id: 'automations',
    path: '/automations',
    label: 'Automations',
    group: 'operator',
    status: 'enabled',
    wave: 6,
    summary: 'Local rules over the local store, with a gate before anything is written.',
    icon: Workflow,
  },
  {
    id: 'analytics',
    path: '/analytics',
    label: 'Analytics',
    group: 'operator',
    status: 'enabled',
    wave: 6,
    summary: 'How the surface is used and what the operation produced, counted locally.',
    icon: Layers,
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
  // Wave 7. Routed now that it has something honest to be: the adapter states
  // Connected, Disabled, or Awaiting Credentials for a Command API base URL,
  // and runs a health probe when one is configured. It claims no read-model and
  // no write-through, and the page says so rather than implying otherwise
  // (ARCHITECTURE_AUDIT §5.3, §5.7).
  {
    id: 'sync',
    path: '/sync',
    label: 'Command API Sync',
    group: 'operator',
    status: 'enabled',
    wave: 7,
    summary: 'The Command API adapter, its state, and the one probe it can run.',
    icon: Database,
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
] as const;

/**
 * Nested surfaces under a module's own path. A module with sub-routes is a hub:
 * the sidebar still shows one entry, the sub-routes appear as tabs on the pages
 * themselves, and the router and the href allowlist both build from this table.
 *
 * Wave 4 is the first module to need them, because the Content OS is a loop of
 * surfaces rather than one list, and nine top-level nav rows for one module
 * would be the fake-inventory problem the audit exists to prevent.
 */
export interface SubRouteDefinition {
  id: string;
  moduleId: string;
  /** Static path beneath the module path. Never carries a parameter. */
  path: string;
  label: string;
  summary: string;
}

export const subRoutes: readonly SubRouteDefinition[] = [
  {
    id: 'content-ideas',
    moduleId: 'content',
    path: '/content/ideas',
    label: 'Idea Vault',
    summary: 'Captured ideas, scored on reach, effort, and confidence.',
  },
  {
    id: 'content-calendar',
    moduleId: 'content',
    path: '/content/calendar',
    label: 'Publishing Calendar',
    summary: 'One week of publish dates, and what carries no date at all.',
  },
  {
    id: 'content-campaigns',
    moduleId: 'content',
    path: '/content/campaigns',
    label: 'Campaigns',
    summary: 'The arcs content belongs to, with their production counted.',
  },
  {
    id: 'content-library',
    moduleId: 'content',
    path: '/content/library',
    label: 'Library',
    summary: 'Hooks, CTAs, assets, and templates behind one filter.',
  },
  {
    id: 'content-analytics',
    moduleId: 'content',
    path: '/content/analytics',
    label: 'Performance',
    summary: 'Recorded readings, what they suggest, and how large the sample is.',
  },
  // MCP servers are integration rows, so the panel is a surface of the registry
  // rather than a module of its own: one table of state, read two ways. A
  // top-level `/mcp` would have to keep its own idea of Connected in step with
  // the registry's, and two sources of that answer eventually disagree.
  {
    id: 'integrations-mcp',
    moduleId: 'integrations',
    path: '/integrations/mcp',
    label: 'MCP Servers',
    summary: 'Model Context Protocol servers and the state the registry records for each.',
  },
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
  // Under `/content/item/` rather than `/content/:id`, so a package id can never
  // collide with — or be mistaken for — one of the hub's sub-routes.
  { id: 'content-item', moduleId: 'content', pattern: '/content/item/:id' },
  // Wave 5 follows the same rule: a segment names the record type, so a node id
  // can never be confused with a surface of its own module.
  { id: 'knowledge-node', moduleId: 'knowledge', pattern: '/knowledge/node/:id' },
  { id: 'document', moduleId: 'documents', pattern: '/documents/doc/:id' },
  { id: 'decision', moduleId: 'decisions', pattern: '/decisions/entry/:id' },
  // Wave 6 keeps the rule: the segment names the record type, so a rule id can
  // never be read as a surface of the module that owns it.
  { id: 'automation-rule', moduleId: 'automations', pattern: '/automations/rule/:id' },
  { id: 'mission', moduleId: 'missions', pattern: '/missions/mission/:id' },
] as const;

export function enabledModules(): ModuleDefinition[] {
  return moduleRegistry.filter((module) => module.status === 'enabled');
}

/** Detail routes whose owning module is enabled. Planned modules serve nothing. */
export function enabledRecordRoutes(): RecordRouteDefinition[] {
  const enabled = new Set(enabledModules().map((module) => module.id));
  return recordRoutes.filter((route) => enabled.has(route.moduleId));
}

/** Sub-routes whose owning module is enabled. */
export function enabledSubRoutes(): SubRouteDefinition[] {
  const enabled = new Set(enabledModules().map((module) => module.id));
  return subRoutes.filter((route) => enabled.has(route.moduleId));
}

/** The sub-routes of one module, in declaration order. Hub tabs read this. */
export function subRoutesOf(moduleId: string): SubRouteDefinition[] {
  return enabledSubRoutes().filter((route) => route.moduleId === moduleId);
}

export function plannedModules(): ModuleDefinition[] {
  return moduleRegistry
    .filter((module) => module.status === 'planned')
    .sort((a, b) => a.wave - b.wave || a.label.localeCompare(b.label));
}

export function modulesByGroup(group: ModuleGroup): ModuleDefinition[] {
  return enabledModules().filter((module) => module.group === group);
}

/**
 * The module a path belongs to: an exact match, or the module that owns the
 * prefix, so a sub-route or a detail page is still named after its module.
 */
export function findModuleByPath(path: string): ModuleDefinition | undefined {
  const exact = moduleRegistry.find((module) => module.path === path);
  if (exact) return exact;
  return moduleRegistry
    .filter((module) => module.path !== '/' && path.startsWith(`${module.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

export const groupLabel: Record<ModuleGroup, string> = {
  commander: 'Commander',
  operator: 'Operator',
};

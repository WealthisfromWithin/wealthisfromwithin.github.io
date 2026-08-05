import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  CalendarDays,
  ChartColumn,
  CheckCheck,
  Database,
  FileStack,
  FileText,
  Flame,
  Inbox,
  Layers,
  Lightbulb,
  ListChecks,
  NotebookPen,
  Plug,
  Radar,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { enabledModules } from '@/app/modules';

export type CommandGroup = 'navigate' | 'act' | 'store' | 'surface';

export interface Command {
  id: string;
  label: string;
  hint: string;
  group: CommandGroup;
  keywords: string[];
  icon: LucideIcon;
  run: () => void | Promise<void>;
}

export const commandGroupLabel: Record<CommandGroup, string> = {
  navigate: 'Go to',
  act: 'Act',
  store: 'Local store',
  surface: 'Surface',
};

export interface CommandActions {
  navigate: (path: string) => void;
  reseedDemoData: () => Promise<void>;
  resetStore: () => Promise<void>;
  markAllRead: () => Promise<void>;
  openSearch: () => void;
}

/** Only enabled modules can be reached: the palette never offers a dead route. */
export function buildCommands(actions: CommandActions): Command[] {
  const navigation: Command[] = enabledModules().map((module) => ({
    id: `navigate:${module.id}`,
    label: module.label,
    hint: module.summary,
    group: 'navigate',
    keywords: [module.path, module.group, module.id],
    icon: module.icon,
    run: () => {
      actions.navigate(module.path);
    },
  }));

  return [
    ...navigation,
    {
      id: 'act:approvals-pending',
      label: 'Review pending approvals',
      hint: 'Open the queue filtered to gates still waiting on a decision.',
      group: 'act',
      keywords: ['approve', 'reject', 'gate', 'queue'],
      icon: ShieldCheck,
      run: () => {
        actions.navigate('/approvals?status=pending');
      },
    },
    {
      id: 'act:inbox-unread',
      label: 'Review unread signals',
      hint: 'Open the inbox filtered to unread notifications.',
      group: 'act',
      keywords: ['inbox', 'unread', 'notifications', 'signals'],
      icon: Inbox,
      run: () => {
        actions.navigate('/inbox?status=unread');
      },
    },
    {
      id: 'act:mark-all-read',
      label: 'Mark every signal read',
      hint: 'Writes read state for all unread notifications in the local store.',
      group: 'act',
      keywords: ['inbox', 'clear', 'read', 'notifications'],
      icon: CheckCheck,
      run: actions.markAllRead,
    },
    {
      id: 'act:pipeline-stalled',
      label: 'Review the open pipeline',
      hint: 'Open opportunities ranked by expected value, stalled deals flagged.',
      group: 'act',
      keywords: ['pipeline', 'opportunities', 'revenue', 'stalled', 'deals'],
      icon: TrendingUp,
      run: () => {
        actions.navigate('/pipeline');
      },
    },
    {
      id: 'act:tasks-open',
      label: 'Review open tasks',
      hint: 'Every task that is not done, overdue first.',
      group: 'act',
      keywords: ['tasks', 'todo', 'work', 'overdue', 'execution'],
      icon: ListChecks,
      run: () => {
        actions.navigate('/tasks?status=open');
      },
    },
    {
      id: 'act:tasks-blocked',
      label: 'Review blocked work',
      hint: 'Tasks that cannot move, with the reason recorded on each.',
      group: 'act',
      keywords: ['blocked', 'stuck', 'tasks', 'reason'],
      icon: ListChecks,
      run: () => {
        actions.navigate('/tasks?status=blocked');
      },
    },
    {
      id: 'act:crm-dormant',
      label: 'Review dormant relationships',
      hint: 'People with no recorded touch in three weeks or more.',
      group: 'act',
      keywords: ['crm', 'dormant', 'relationship', 'people', 'cold'],
      icon: Flame,
      run: () => {
        actions.navigate('/crm?temperature=dormant');
      },
    },
    {
      id: 'act:content-review',
      label: 'Review content awaiting approval',
      hint: 'Packages holding an open gate. Nothing publishes until one is cleared.',
      group: 'act',
      keywords: ['content', 'approval', 'gate', 'review', 'publish'],
      icon: FileText,
      run: () => {
        actions.navigate('/content?status=in_review');
      },
    },
    {
      id: 'act:content-due',
      label: 'Content due to publish',
      hint: 'This week of publish dates. Publishing is recorded by hand.',
      group: 'act',
      keywords: ['content', 'calendar', 'publish', 'due', 'schedule'],
      icon: CalendarDays,
      run: () => {
        actions.navigate('/content/calendar');
      },
    },
    {
      id: 'act:decisions-open',
      label: 'Decisions awaiting a call',
      hint: 'Every consequential question nobody has answered yet.',
      group: 'act',
      keywords: ['decision', 'call', 'choose', 'open', 'log'],
      icon: ScrollText,
      run: () => {
        actions.navigate('/decisions?status=proposed');
      },
    },
    {
      id: 'act:memory-review',
      label: 'Memories past their review date',
      hint: 'Durable facts the store will not keep trusting without a re-confirmation.',
      group: 'act',
      keywords: ['memory', 'review', 'stale', 'confirm', 'decay'],
      icon: Sparkles,
      run: () => {
        actions.navigate('/memory?state=review');
      },
    },
    {
      id: 'act:research-open',
      label: 'Open research questions',
      hint: 'Questions with no answer. Nothing fetches one; findings are written by hand.',
      group: 'act',
      keywords: ['research', 'question', 'unknown', 'finding'],
      icon: Radar,
      run: () => {
        actions.navigate('/research');
      },
    },
    {
      id: 'act:automations-blocked',
      label: 'Automations that cannot run',
      hint: 'Rules waiting on a connector this bundle cannot reach. They refuse rather than fail quietly.',
      group: 'act',
      keywords: ['automation', 'rule', 'blocked', 'n8n', 'workflow', 'refused'],
      icon: Workflow,
      run: () => {
        actions.navigate('/automations?state=blocked');
      },
    },
    {
      id: 'act:missions-blocked',
      label: 'Objectives that cannot move',
      hint: 'Blocked missions, with the blocker recorded on each.',
      group: 'act',
      keywords: ['mission', 'objective', 'blocked', 'goal'],
      icon: Target,
      run: () => {
        actions.navigate('/missions?status=blocked');
      },
    },
    {
      id: 'surface:automations',
      label: 'Open the Automation Center',
      hint: 'Local rules over the local store. Nothing publishes and nothing runs on a timer.',
      group: 'surface',
      keywords: ['automation', 'rules', 'workflow', 'leverage', 'run'],
      icon: Workflow,
      run: () => {
        actions.navigate('/automations');
      },
    },
    {
      id: 'surface:missions',
      label: 'Open Mission Control',
      hint: 'Objectives with progress counted from the work linked to them.',
      group: 'surface',
      keywords: ['mission', 'objective', 'goal', 'progress'],
      icon: Target,
      run: () => {
        actions.navigate('/missions');
      },
    },
    {
      id: 'surface:metrics',
      label: 'Open Business Metrics',
      hint: 'Financial KPIs counted from the local domain. No finance API is called.',
      group: 'surface',
      keywords: ['metrics', 'kpi', 'revenue', 'financial', 'pipeline', 'money'],
      icon: ChartColumn,
      run: () => {
        actions.navigate('/metrics');
      },
    },
    {
      id: 'surface:analytics',
      label: 'Open Analytics',
      hint: 'Recorded activity, throughput, and provenance. Nothing observes the operator.',
      group: 'surface',
      keywords: ['analytics', 'usage', 'activity', 'throughput', 'events'],
      icon: Layers,
      run: () => {
        actions.navigate('/analytics');
      },
    },
    {
      id: 'surface:mcp',
      label: 'Review MCP servers',
      hint: 'Connected, Disabled, or Awaiting Credentials — read from the registry, never probed here.',
      group: 'surface',
      keywords: ['mcp', 'server', 'hermes', 'model context protocol', 'tools'],
      icon: Plug,
      run: () => {
        actions.navigate('/integrations/mcp');
      },
    },
    {
      id: 'surface:knowledge-pinned',
      label: 'Pinned knowledge',
      hint: 'What the operation knows, with the records each note is about.',
      group: 'surface',
      keywords: ['knowledge', 'notes', 'insight', 'playbook', 'pinned'],
      icon: Brain,
      run: () => {
        actions.navigate('/knowledge?view=pinned');
      },
    },
    {
      id: 'surface:documents',
      label: 'Open the document store',
      hint: 'Local documents rendered as text. Nothing is uploaded or hosted.',
      group: 'surface',
      keywords: ['document', 'memo', 'proposal', 'sop', 'transcript'],
      icon: FileStack,
      run: () => {
        actions.navigate('/documents');
      },
    },
    {
      id: 'surface:ai-workspace',
      label: 'Open the AI Workspace',
      hint: 'Sessions against the Agent Kernel. It refuses rather than pretends.',
      group: 'surface',
      keywords: ['ai', 'agent', 'kernel', 'model', 'provider', 'llm'],
      icon: Bot,
      run: () => {
        actions.navigate('/ai');
      },
    },
    {
      id: 'surface:content-ideas',
      label: 'Open the idea vault',
      hint: 'Captured ideas ranked on the scores recorded against them.',
      group: 'surface',
      keywords: ['idea', 'vault', 'capture', 'content', 'score'],
      icon: Lightbulb,
      run: () => {
        actions.navigate('/content/ideas');
      },
    },
    {
      id: 'surface:content-learning',
      label: 'Content performance and learning',
      hint: 'Recorded readings, what they suggest, and the size of the sample.',
      group: 'surface',
      keywords: ['content', 'analytics', 'learning', 'performance', 'insight'],
      icon: ChartColumn,
      run: () => {
        actions.navigate('/content/analytics');
      },
    },
    {
      id: 'surface:calendar-week',
      label: 'Open this week',
      hint: 'Meetings and work due, merged into one agenda.',
      group: 'surface',
      keywords: ['calendar', 'week', 'agenda', 'schedule', 'time'],
      icon: CalendarDays,
      run: () => {
        actions.navigate('/calendar');
      },
    },
    {
      id: 'surface:meetings-notes',
      label: 'Meetings awaiting notes',
      hint: 'Past meetings with nothing written about what happened.',
      group: 'surface',
      keywords: ['meetings', 'notes', 'past', 'record'],
      icon: NotebookPen,
      run: () => {
        actions.navigate('/meetings?when=past');
      },
    },
    {
      id: 'surface:health',
      label: 'Check substrate health',
      hint: 'Registry-derived health. No probe has run, so nothing claims Connected.',
      group: 'surface',
      keywords: ['health', 'substrate', 'status', 'logs', 'events'],
      icon: Activity,
      run: () => {
        actions.navigate('/health');
      },
    },
    {
      id: 'surface:search',
      label: 'Search records',
      hint: 'People, tasks, opportunities, content, integrations.',
      group: 'surface',
      keywords: ['find', 'lookup', 'global'],
      icon: Search,
      run: actions.openSearch,
    },
    {
      id: 'store:reseed',
      label: 'Refresh demo data',
      hint: 'Rebuild the badged demo seed against the current time.',
      group: 'store',
      keywords: ['seed', 'demo', 'sample'],
      icon: RefreshCw,
      run: actions.reseedDemoData,
    },
    {
      id: 'store:reset',
      label: 'Reset local store',
      hint: 'Delete the IndexedDB database and reseed from scratch.',
      group: 'store',
      keywords: ['wipe', 'clear', 'indexeddb', 'dexie'],
      icon: Database,
      run: actions.resetStore,
    },
    {
      id: 'surface:integrations',
      label: 'Review credential gaps',
      hint: 'Open the integration registry filtered to awaiting credentials.',
      group: 'surface',
      keywords: ['credentials', 'awaiting', 'connect'],
      icon: ArrowRight,
      run: () => {
        actions.navigate('/integrations?state=awaiting_credentials');
      },
    },
  ];
}

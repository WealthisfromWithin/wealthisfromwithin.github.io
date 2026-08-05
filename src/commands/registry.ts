import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Database, RefreshCw, Search } from 'lucide-react';
import { enabledModules } from '@/app/modules';

export type CommandGroup = 'navigate' | 'store' | 'surface';

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
  store: 'Local store',
  surface: 'Surface',
};

export interface CommandActions {
  navigate: (path: string) => void;
  reseedDemoData: () => Promise<void>;
  resetStore: () => Promise<void>;
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

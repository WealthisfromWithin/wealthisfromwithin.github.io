import { NavLink } from 'react-router-dom';
import { groupLabel, modulesByGroup, type ModuleGroup } from '@/app/modules';
import { cn } from '@/lib/cn';
import { useSovereign } from '@/app/context';
import { deriveSubstrateHealth } from '@/integrations/state';

const GROUPS: ModuleGroup[] = ['commander', 'operator'];

function SubstrateLine() {
  const { dataset, ready } = useSovereign();
  const health = deriveSubstrateHealth(dataset.integrations);

  const tone =
    health.status === 'operational'
      ? 'text-sentinel'
      : health.status === 'degraded'
        ? 'text-gold'
        : 'text-faint';

  return (
    <div className="border-t border-line px-4 py-3">
      <p className="label-caps text-faint">Substrate</p>
      <p className={cn('mt-1 font-mono text-xs', tone)}>
        {ready ? health.statement : 'Reading local store…'}
      </p>
      <p className="mt-1 text-[0.65rem] leading-4 text-faint">
        Derived from the integration registry. No probe has run.
      </p>
    </div>
  );
}

export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-surface/40"
    >
      <div className="border-b border-line px-4 py-4">
        <p className="font-display text-base leading-none text-gold">Sovereign</p>
        <p className="label-caps mt-1.5 text-faint">Command Center</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
          const modules = modulesByGroup(group);
          if (modules.length === 0) return null;
          return (
            <div key={group} className="mb-4">
              <p className="label-caps px-4 py-1.5 text-faint">{groupLabel[group]}</p>
              <ul>
                {modules.map((module) => (
                  <li key={module.id}>
                    <NavLink
                      to={module.path}
                      end={module.path === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 border-l-2 px-4 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'border-gold bg-gold-faint text-ivory'
                            : 'border-transparent text-muted hover:border-gold/40 hover:text-ivory',
                        )
                      }
                    >
                      <module.icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                      <span className="truncate">{module.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <SubstrateLine />
    </nav>
  );
}

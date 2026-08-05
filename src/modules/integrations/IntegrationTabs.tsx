import { NavLink } from 'react-router-dom';
import { subRoutesOf } from '@/app/modules';
import { cn } from '@/lib/cn';

const tab = 'label-caps border px-2.5 py-1 transition-colors';

/**
 * The registry's own navigation. MCP servers are integration rows, so the panel
 * is a lens on this module rather than a module of its own: one table of state,
 * read two ways.
 */
export function IntegrationTabs() {
  return (
    <nav aria-label="Registry surfaces" className="mb-4 flex flex-wrap items-center gap-2">
      <NavLink
        to="/integrations"
        end
        className={({ isActive }) =>
          cn(
            tab,
            isActive
              ? 'border-gold/60 bg-gold-faint text-ivory'
              : 'border-line text-faint hover:border-gold/40 hover:text-muted',
          )
        }
      >
        All Connectors
      </NavLink>
      {subRoutesOf('integrations').map((route) => (
        <NavLink
          key={route.id}
          to={route.path}
          title={route.summary}
          className={({ isActive }) =>
            cn(
              tab,
              isActive
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )
          }
        >
          {route.label}
        </NavLink>
      ))}
    </nav>
  );
}

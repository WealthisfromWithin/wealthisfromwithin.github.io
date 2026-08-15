import { NavLink } from 'react-router-dom';
import { subRoutesOf } from '@/app/modules';
import { cn } from '@/lib/cn';

const tab = 'label-caps border px-2.5 py-1 transition-colors';

/**
 * The hub's own navigation. `/content` keeps one sidebar row; its surfaces are
 * tabs here, so the operator can see the loop without the nav claiming nine
 * modules exist.
 */
export function ContentTabs() {
  return (
    <nav aria-label="Content surfaces" className="mb-4 flex flex-wrap items-center gap-2">
      <NavLink
        to="/content"
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
        Production Queue
      </NavLink>
      {subRoutesOf('content').map((route) => (
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

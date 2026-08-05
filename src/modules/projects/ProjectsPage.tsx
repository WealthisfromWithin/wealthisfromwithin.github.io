import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { companyHref } from '@/app/href';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, EmptyLine, SectionLabel, StatePill } from '@/ui/primitives';
import { taskStatusLabel } from '@/modules/tasks/tasks';
import {
  PROJECT_FILTERS,
  parseProjectFilter,
  projectCounts,
  projectFilterLabel,
  projectStatusLabel,
  projectStatusTone,
  selectProjects,
  type ProjectRow,
} from './projects';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-px w-full bg-line" aria-hidden>
      <div className="h-px bg-gold" style={{ width: `${String(percent)}%` }} />
    </div>
  );
}

function ProjectCard({ row, now }: { row: ProjectRow; now: Date }) {
  const { project, progress } = row;
  const openTasks = row.tasks.filter((task) => task.status !== 'done');

  return (
    <li className="border-b border-line/60 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm text-ivory">{project.title}</h2>
        <StatePill tone={projectStatusTone[project.status]}>
          {projectStatusLabel[project.status]}
        </StatePill>
        {project.source === 'demo' ? <DemoBadge /> : null}
        <span className="ml-auto font-mono text-[0.65rem] text-faint tabular-nums">
          {progress.done}/{progress.total} tasks · {progress.percent}%
        </span>
      </div>

      {project.objective ? (
        <p className="mt-1 text-xs leading-5 text-muted">{project.objective}</p>
      ) : null}
      {project.status === 'blocked' && project.blockedReason ? (
        <p className="mt-1 text-xs leading-5 text-gold/80">{project.blockedReason}</p>
      ) : null}

      <div className="mt-2">
        <ProgressBar percent={progress.percent} />
      </div>

      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
        {project.dueAt ? <span>due {relativeTime(project.dueAt, now)}</span> : <span>no date</span>}
        {row.company ? (
          <>
            <span aria-hidden>·</span>
            <Link to={companyHref(row.company.id)} className="hover:text-ivory">
              {row.company.name}
            </Link>
          </>
        ) : null}
        {progress.blocked > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-gold">{progress.blocked} blocked</span>
          </>
        ) : null}
      </p>

      {openTasks.length === 0 ? (
        <EmptyLine>
          {progress.total === 0 ? 'No tasks attached yet.' : 'Every attached task is done.'}
        </EmptyLine>
      ) : (
        <ul className="mt-2 border-t border-line/50">
          {openTasks.map((task) => (
            <li key={task.id} className="flex items-baseline gap-3 py-1">
              <Link to="/tasks" className="min-w-0 flex-1 truncate text-xs text-muted hover:text-ivory">
                {task.title}
              </Link>
              <span className="label-caps shrink-0 text-faint">{taskStatusLabel[task.status]}</span>
              <span className="shrink-0 font-mono text-[0.65rem] text-faint">
                {task.dueAt ? relativeTime(task.dueAt, now) : 'no date'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ProjectsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const filter = parseProjectFilter(searchParams.get('status'));
  const counts = useMemo(() => projectCounts(dataset), [dataset]);
  const rows = useMemo(() => selectProjects(dataset, filter), [dataset, filter]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Execution</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Projects</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          The work tasks belong to. Progress is counted from those tasks every render, so a
          percentage here can never be stale — and blocked projects state their reason.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Projects</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.total}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Active</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">{counts.active}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Blocked</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.blocked}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open tasks</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">
              <Link to="/tasks" className="hover:text-gold">
                {counts.openTasks}
              </Link>
            </dd>
          </div>
        </dl>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PROJECT_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'active' ? {} : { status: value });
            }}
            className={cn(
              'label-caps border px-2.5 py-1 transition-colors',
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {projectFilterLabel[value]}
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'The local store holds no projects.'
            : 'No projects in this state.'}
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <ProjectCard key={row.project.id} row={row} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}

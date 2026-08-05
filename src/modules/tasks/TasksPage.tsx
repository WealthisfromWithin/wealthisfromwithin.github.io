import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { opportunityHref, personHref } from '@/app/href';
import { createTask, setTaskStatus } from '@/data/mutations';
import type { Task, TaskStatus } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DemoBadge, SectionLabel, StatePill } from '@/ui/primitives';
import {
  TASK_NEXT_STATUS,
  TASK_PRIORITY_FILTERS,
  TASK_STATUS_FILTERS,
  isOverdue,
  parseTaskQuery,
  priorityTone,
  selectTasks,
  taskCounts,
  taskLinks,
  taskPriorityFilterLabel,
  taskStatusFilterLabel,
  taskStatusLabel,
  type TaskQuery,
} from './tasks';

const filterButton = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';
const rowButton = 'label-caps border px-2 py-0.5 transition-colors disabled:opacity-40';

function TaskRow({
  task,
  now,
  busy,
  onStatus,
}: {
  task: Task;
  now: Date;
  busy: boolean;
  onStatus: (task: Task, status: TaskStatus) => void;
}) {
  const { dataset } = useSovereign();
  const links = useMemo(() => taskLinks(dataset, task), [dataset, task]);
  const next = TASK_NEXT_STATUS[task.status];
  const overdue = isOverdue(task, now);

  return (
    <li className="border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-sm',
                task.status === 'done' ? 'text-faint line-through' : 'text-ivory',
              )}
            >
              {task.title}
            </span>
            {task.source === 'demo' ? <DemoBadge /> : null}
            {overdue ? <StatePill tone="critical">Overdue</StatePill> : null}
            {task.status === 'blocked' ? <StatePill tone="warning">Blocked</StatePill> : null}
          </div>
          {task.status === 'blocked' && task.blockedReason ? (
            <p className="mt-0.5 text-xs leading-5 text-gold/80">{task.blockedReason}</p>
          ) : task.context ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{task.context}</p>
          ) : null}
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>{taskStatusLabel[task.status]}</span>
            <span aria-hidden>·</span>
            <span>{task.priority}</span>
            {task.dueAt ? (
              <>
                <span aria-hidden>·</span>
                <span className={overdue ? 'text-alert' : undefined}>
                  due {relativeTime(task.dueAt, now)}
                </span>
              </>
            ) : null}
            {links.project ? (
              <>
                <span aria-hidden>·</span>
                <Link to="/projects" className="hover:text-ivory">
                  {links.project.title}
                </Link>
              </>
            ) : null}
            {links.person ? (
              <>
                <span aria-hidden>·</span>
                <Link to={personHref(links.person.id)} className="hover:text-ivory">
                  {links.person.name}
                </Link>
              </>
            ) : null}
            {links.opportunity ? (
              <>
                <span aria-hidden>·</span>
                <Link to={opportunityHref(links.opportunity.id)} className="hover:text-ivory">
                  {links.opportunity.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <StatePill tone={priorityTone(task.priority)}>{task.priority}</StatePill>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onStatus(task, next);
            }}
            className={cn(rowButton, 'border-line text-muted hover:border-gold/40 hover:text-ivory')}
          >
            {`Mark ${taskStatusLabel[next].toLowerCase()}`}
          </button>
        </div>
      </div>
    </li>
  );
}

function NewTaskForm({ onCreated }: { onCreated: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mb-4 flex flex-wrap items-center gap-2 border border-line bg-surface/50 px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim().length === 0) return;
        setBusy(true);
        void createTask({ title })
          .then((task) => {
            if (task) {
              setTitle('');
              onCreated(`Added "${task.title}". Operator-owned, so no reseed will remove it.`);
            }
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <label className="label-caps text-faint" htmlFor="new-task-title">
        New task
      </label>
      <input
        id="new-task-title"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
        placeholder="What has to happen?"
        className="min-w-0 flex-1 bg-transparent text-sm text-ivory outline-none placeholder:text-faint"
      />
      <button
        type="submit"
        disabled={busy || title.trim().length === 0}
        className={cn(rowButton, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
      >
        Add
      </button>
    </form>
  );
}

export function TasksPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const query = parseTaskQuery(searchParams);
  const counts = useMemo(() => taskCounts(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectTasks(dataset, query, now), [dataset, query, now]);

  function applyQuery(next: Partial<TaskQuery>) {
    const merged: TaskQuery = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.status !== 'open') params.set('status', merged.status);
    if (merged.priority !== 'all') params.set('priority', merged.priority);
    setSearchParams(params);
  }

  function changeStatus(task: Task, status: TaskStatus) {
    setBusy(true);
    setMessage(null);
    void setTaskStatus(task.id, status)
      .then((changed) => {
        setMessage(
          changed
            ? `${taskStatusLabel[status]}: ${task.title}. Written to the local store.`
            : 'Nothing changed.',
        );
      })
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'Status change failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Execution</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Tasks</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Work in one list, overdue first. Status changes and new tasks are written to IndexedDB;
          tasks you create are operator-owned and survive every demo reseed.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Open</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.open}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Overdue</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.overdue}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Due today</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.dueToday}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Blocked</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.blocked}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Done</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">{counts.done}</dd>
          </div>
        </dl>
      </header>

      <NewTaskForm onCreated={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TASK_STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              applyQuery({ status: value });
            }}
            className={cn(
              filterButton,
              query.status === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {taskStatusFilterLabel[value]}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-line" aria-hidden />

        {TASK_PRIORITY_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              applyQuery({ priority: value });
            }}
            className={cn(
              filterButton,
              query.priority === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {taskPriorityFilterLabel[value]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0 ? 'The local store holds no tasks.' : 'No tasks match this filter.'}
        </p>
      ) : (
        <ul>
          {rows.map((task) => (
            <TaskRow key={task.id} task={task} now={now} busy={busy} onStatus={changeStatus} />
          ))}
        </ul>
      )}
    </div>
  );
}

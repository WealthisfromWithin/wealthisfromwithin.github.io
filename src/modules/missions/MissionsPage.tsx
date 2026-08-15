import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { missionHref } from '@/app/href';
import { captureMission } from '@/data/mutations';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatCurrencyCents } from '@/lib/format';
import { DemoBadge, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import {
  MISSION_FILTERS,
  missionCounts,
  missionFilterLabel,
  missionStatusLabel,
  missionStatusTone,
  parseMissionFilter,
  selectMissions,
  type MissionRollup,
} from './missions';

const button = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function NewMissionForm({ onDone }: { onDone: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [busy, setBusy] = useState(false);

  function submit() {
    if (title.trim().length === 0) return;
    setBusy(true);
    void captureMission({ title, objective })
      .then((mission) => {
        if (mission) {
          setTitle('');
          setObjective('');
          onDone(
            `Opened ${mission.code}. Link work to it from the tasks, deals, and campaigns it needs — an objective with nothing pointing at it counts nothing.`,
          );
        } else {
          onDone('An objective needs a title.');
        }
      })
      .catch((cause: unknown) => {
        onDone(cause instanceof Error ? cause.message : 'Opening the objective failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <form
      className="mb-4 border border-line bg-surface/50 px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="label-caps text-faint" htmlFor="mission-title">
        Open an objective
      </label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          id="mission-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="What is to be achieved"
          className="min-w-56 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <input
          id="mission-objective"
          aria-label="The objective in one sentence"
          value={objective}
          onChange={(event) => {
            setObjective(event.target.value);
          }}
          placeholder="The objective, in one sentence"
          className="min-w-56 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={busy || title.trim().length === 0}
          className={cn(button, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
        >
          New objective
        </button>
      </div>
    </form>
  );
}

function MissionCard({ rollup, now }: { rollup: MissionRollup; now: Date }) {
  const { mission } = rollup;

  return (
    <li className="border-b border-line/60 py-3 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link to={missionHref(mission.id)} className="text-sm text-ivory hover:text-gold">
              <span className="font-mono text-xs text-faint">{mission.code}</span> {mission.title}
            </Link>
            {mission.source === 'demo' ? <DemoBadge /> : null}
            <StatePill tone={missionStatusTone(mission.status)}>
              {missionStatusLabel[mission.status]}
            </StatePill>
            {rollup.tasks.length === 0 &&
            rollup.projects.length === 0 &&
            rollup.opportunities.length === 0 &&
            rollup.campaigns.length === 0 ? (
              <StatePill tone="warning" title="No local record points at this objective.">
                Nothing serves it
              </StatePill>
            ) : null}
            {rollup.overdueTasks > 0 ? (
              <StatePill tone="critical">{rollup.overdueTasks} overdue</StatePill>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs leading-5 text-muted">
            {mission.objective.length > 0 ? mission.objective : 'No objective sentence recorded.'}
          </p>

          {mission.status === 'blocked' ? (
            <p className="mt-0.5 text-xs leading-5 text-alert">
              {mission.blockedReason ?? 'Blocked with no reason recorded.'}
            </p>
          ) : null}

          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.65rem] text-faint">
            <span>
              {rollup.doneTasks}/{rollup.tasks.length} tasks done
            </span>
            <span aria-hidden>·</span>
            <span>{rollup.projects.length} projects</span>
            {rollup.openValueCents > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatCurrencyCents(rollup.openValueCents)} open</span>
              </>
            ) : null}
            {rollup.campaigns.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {rollup.publishedContent}/{rollup.contentItems.length} packages published
                </span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>
              {rollup.nextDateAt === undefined
                ? 'no date on it or its work'
                : `next date ${relativeTime(rollup.nextDateAt, now)}`}
            </span>
          </p>
        </div>

        <div className="w-40 shrink-0">
          <p className="label-caps text-faint">Declared</p>
          <p className="font-mono text-sm text-ivory tabular-nums">{mission.progress}%</p>
          <p className="label-caps mt-1 text-faint">Counted</p>
          <p className="font-mono text-sm text-sentinel tabular-nums">
            {rollup.countedProgress === null ? '—' : `${String(rollup.countedProgress)}%`}
          </p>
          <p className="mt-0.5 text-[0.65rem] leading-4 text-faint">
            {rollup.countedProgress === null
              ? 'Nothing linked to count.'
              : 'Tasks done over tasks linked.'}
          </p>
        </div>
      </div>
    </li>
  );
}

export function MissionsPage() {
  const { dataset, ready } = useSovereign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const filter = parseMissionFilter(searchParams.get('status'));
  const counts = useMemo(() => missionCounts(dataset, now), [dataset, now]);
  const rows = useMemo(() => selectMissions(dataset, filter, now), [dataset, filter, now]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <SectionLabel>Command</SectionLabel>
        <h1 className="mt-1 font-display text-2xl text-ivory">Mission Control</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Objectives, and the local work that actually serves them. Each one carries two progress
          figures: the percentage the operator declared, and the percentage counted from the tasks
          linked to it. They are printed side by side and never averaged — a number someone typed
          and a number the store measured are different claims.
        </p>

        <dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-line py-3">
          <div>
            <dt className="label-caps text-faint">Open</dt>
            <dd className="font-mono text-lg text-ivory tabular-nums">{counts.open}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Blocked</dt>
            <dd className="font-mono text-lg text-alert tabular-nums">{counts.blocked}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Nothing serves it</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.unserved}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Overdue work</dt>
            <dd className="font-mono text-lg text-gold tabular-nums">{counts.overdueTasks}</dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Open value linked</dt>
            <dd className="font-mono text-lg text-sentinel tabular-nums">
              {formatCurrencyCents(counts.openValueCents)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-faint">Won value linked</dt>
            <dd className="font-mono text-lg text-muted tabular-nums">
              {formatCurrencyCents(counts.wonValueCents)}
            </dd>
          </div>
        </dl>
      </header>

      <NewMissionForm onDone={setMessage} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {MISSION_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams(value === 'open' ? {} : { status: value });
            }}
            className={cn(
              button,
              filter === value
                ? 'border-gold/60 bg-gold-faint text-ivory'
                : 'border-line text-faint hover:border-gold/40 hover:text-muted',
            )}
          >
            {missionFilterLabel[value]}
          </button>
        ))}
      </div>

      {message ? <p className="mb-2 text-xs text-muted">{message}</p> : null}

      {!ready ? (
        <p className="text-sm text-faint italic">Opening the local store…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint italic">
          {counts.total === 0
            ? 'No objective has been opened yet.'
            : 'No objective matches this filter.'}
        </p>
      ) : (
        <ul className="mb-5">
          {rows.map((rollup) => (
            <MissionCard key={rollup.mission.id} rollup={rollup} now={now} />
          ))}
        </ul>
      )}

      <Panel title="What Mission Control does not know">
        <ul className="space-y-1.5 text-xs leading-5 text-muted">
          <li>
            It has no forecast. There is no model here that predicts whether an objective will be
            met, and no agent working one on its own.
          </li>
          <li>
            The counted figure only sees links. Work done for an objective without a link to it is
            invisible here, which is an argument for linking rather than for trusting the number.
          </li>
          <li>
            A completed objective is history. Reopening one means opening the next objective, not
            editing the record of the last.
          </li>
        </ul>
      </Panel>
    </div>
  );
}

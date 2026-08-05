import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSovereign } from '@/app/context';
import { contentHref, opportunityHref } from '@/app/href';
import { declareMissionProgress, setMissionStatus } from '@/data/mutations';
import type { MissionStatus } from '@/domain';
import { MISSION_TRANSITIONS } from '@/domain';
import { relativeTime } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatCurrencyCents } from '@/lib/format';
import { DemoBadge, EmptyLine, Panel, SectionLabel, StatePill } from '@/ui/primitives';
import { pipelineStageLabel } from '@/modules/pipeline/pipeline';
import { findMission, missionRollup, missionStatusLabel, missionStatusTone } from './missions';

const button = 'label-caps border px-2.5 py-1 transition-colors disabled:opacity-40';

function MissingMission() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <SectionLabel>Command</SectionLabel>
      <h1 className="mt-1 font-display text-2xl text-ivory">Not in the local store</h1>
      <p className="mt-1 text-sm text-muted">
        No objective with that id is in this browser. The demo rows may have been removed.
      </p>
      <Link
        to="/missions"
        className="label-caps mt-4 inline-block border border-line px-2.5 py-1 text-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Back to Mission Control
      </Link>
    </div>
  );
}

export function MissionPage() {
  const { id } = useParams<{ id: string }>();
  const { dataset, ready } = useSovereign();
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [declared, setDeclared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), []);

  const mission = findMission(dataset, id);

  if (!ready && !mission) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-6">
        <p className="text-sm text-faint italic">Opening the local store…</p>
      </div>
    );
  }
  if (!mission) return <MissingMission />;

  const rollup = missionRollup(dataset, mission, now);
  const moves = MISSION_TRANSITIONS[mission.status];

  function act(work: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    void work()
      .then(setMessage)
      .catch((cause: unknown) => {
        setMessage(cause instanceof Error ? cause.message : 'The change failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const move = (status: MissionStatus) => {
    act(async () => {
      const result = await setMissionStatus(mission.id, status, { reason });
      if (!result.ok) return result.reason ?? 'The move was refused.';
      setReason('');
      return status === 'blocked'
        ? 'Recorded as blocked, with the blocker on the record.'
        : `Recorded as ${missionStatusLabel[status].toLowerCase()}.`;
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <SectionLabel>Objective {mission.code}</SectionLabel>
          {mission.source === 'demo' ? <DemoBadge /> : null}
          <StatePill tone={missionStatusTone(mission.status)}>
            {missionStatusLabel[mission.status]}
          </StatePill>
        </div>
        <h1 className="mt-1 font-display text-2xl text-ivory">{mission.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {mission.objective.length > 0 ? mission.objective : 'No objective sentence recorded.'}
        </p>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-faint">
          {mission.successMeasure.length > 0
            ? `Met when: ${mission.successMeasure}`
            : 'No success measure recorded, so nothing here can say whether it was met.'}
          {mission.dueAt !== undefined ? ` · due ${relativeTime(mission.dueAt, now)}` : ''}
        </p>

        {mission.status === 'blocked' ? (
          <p className="mt-2 text-sm text-alert">
            {mission.blockedReason ?? 'Blocked with no reason recorded.'}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {moves.length === 0 ? (
            <p className="text-xs text-faint">
              A complete objective is history. Open the next objective rather than editing this one.
            </p>
          ) : (
            moves.map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy || (status === 'blocked' && reason.trim().length === 0)}
                onClick={() => {
                  move(status);
                }}
                className={cn(
                  button,
                  status === 'blocked'
                    ? 'border-alert/50 text-alert hover:border-alert hover:text-ivory'
                    : 'border-line text-muted hover:border-gold/40 hover:text-ivory',
                )}
              >
                Mark {missionStatusLabel[status].toLowerCase()}
              </button>
            ))
          )}
          {moves.includes('blocked') ? (
            <input
              aria-label="What is blocking it"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              placeholder="What is blocking it"
              className="min-w-56 flex-1 border border-line bg-surface/60 px-2 py-1.5 text-sm text-on-surface outline-none placeholder:text-faint focus:border-gold/50"
            />
          ) : null}
          <Link
            to="/missions"
            className={cn(button, 'border-line text-faint hover:border-gold/40 hover:text-muted')}
          >
            All objectives
          </Link>
        </div>

        {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Progress, both ways of counting it">
          <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
            <div>
              <p className="label-caps text-faint">Declared by the operator</p>
              <p className="font-mono text-2xl text-ivory tabular-nums">{mission.progress}%</p>
            </div>
            <div>
              <p className="label-caps text-faint">Counted from linked tasks</p>
              <p className="font-mono text-2xl text-sentinel tabular-nums">
                {rollup.countedProgress === null ? '—' : `${String(rollup.countedProgress)}%`}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            {rollup.countedProgress === null
              ? 'Nothing is linked to this objective, so there is nothing to count. The declared figure stands alone.'
              : `${String(rollup.doneTasks)} of ${String(rollup.tasks.length)} linked tasks are done. Where the two figures disagree, the store is only claiming the second one.`}
          </p>

          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(declared ?? mission.progress);
              act(async () => {
                const result = await declareMissionProgress(mission.id, value);
                if (!result.ok) return result.reason ?? 'The declaration was refused.';
                setDeclared(null);
                return 'Recorded as declared progress. The counted figure is unchanged — it counts linked work.';
              });
            }}
          >
            <label className="label-caps text-faint" htmlFor="mission-progress">
              Declare progress
            </label>
            <input
              id="mission-progress"
              type="number"
              min={0}
              max={100}
              value={declared ?? String(mission.progress)}
              onChange={(event) => {
                setDeclared(event.target.value);
              }}
              className="w-20 border border-line bg-surface/60 px-2 py-1 text-sm text-on-surface outline-none focus:border-gold/50"
            />
            <button
              type="submit"
              disabled={busy}
              className={cn(button, 'border-gold/50 text-gold hover:border-gold hover:text-ivory')}
            >
              Record
            </button>
          </form>
        </Panel>

        <Panel title="What is blocking it">
          {rollup.blockers.length === 0 ? (
            <EmptyLine>Nothing linked to this objective is recorded as blocked.</EmptyLine>
          ) : (
            <ul className="space-y-1.5 text-xs leading-5 text-muted">
              {rollup.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 font-mono text-[0.65rem] text-faint">
            {rollup.overdueTasks} overdue · {rollup.blockedTasks} blocked ·{' '}
            {rollup.openTasks} still open
          </p>
        </Panel>

        <Panel title={`Work · ${String(rollup.projects.length)} projects, ${String(rollup.tasks.length)} tasks`}>
          {rollup.projects.length === 0 && rollup.tasks.length === 0 ? (
            <EmptyLine>Nothing points at this objective yet.</EmptyLine>
          ) : (
            <ul>
              {rollup.projects.map((project) => (
                <li key={project.id} className="border-b border-line/50 py-1.5 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Link to="/projects" className="text-sm text-muted hover:text-gold">
                      {project.title}
                    </Link>
                    <span className="ml-auto font-mono text-[0.65rem] text-faint">
                      {project.status}
                    </span>
                  </div>
                </li>
              ))}
              {rollup.tasks.slice(0, 8).map((task) => (
                <li key={task.id} className="border-b border-line/50 py-1.5 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={task.status === 'done' ? '/tasks?status=done' : '/tasks?status=open'}
                      className="text-sm text-muted hover:text-gold"
                    >
                      {task.title}
                    </Link>
                    <span className="ml-auto font-mono text-[0.65rem] text-faint">
                      {task.status} · {task.priority}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Revenue and reach linked to it">
          {rollup.opportunities.length === 0 && rollup.campaigns.length === 0 ? (
            <EmptyLine>No deal or campaign points at this objective.</EmptyLine>
          ) : (
            <>
              <ul>
                {rollup.opportunities.map((opportunity) => (
                  <li
                    key={opportunity.id}
                    className="border-b border-line/50 py-1.5 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Link
                        to={opportunityHref(opportunity.id)}
                        className="text-sm text-muted hover:text-gold"
                      >
                        {opportunity.name}
                      </Link>
                      <span className="ml-auto font-mono text-[0.65rem] text-faint">
                        {pipelineStageLabel[opportunity.stage]} ·{' '}
                        {formatCurrencyCents(opportunity.valueCents)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-mono text-[0.65rem] text-faint">
                {formatCurrencyCents(rollup.openValueCents)} open ·{' '}
                {formatCurrencyCents(rollup.wonValueCents)} won · {rollup.campaigns.length} campaigns
                · {rollup.publishedContent}/{rollup.contentItems.length} packages published
              </p>
              {rollup.contentItems.length > 0 ? (
                <ul className="mt-2">
                  {rollup.contentItems.slice(0, 5).map((item) => (
                    <li key={item.id} className="border-b border-line/50 py-1.5 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={contentHref(item.id)}
                          className="text-sm text-muted hover:text-gold"
                        >
                          {item.title}
                        </Link>
                        <span className="ml-auto font-mono text-[0.65rem] text-faint">
                          {item.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

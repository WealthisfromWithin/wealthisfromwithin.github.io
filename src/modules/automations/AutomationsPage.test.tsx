import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { AutomationsPage } from './AutomationsPage';

function renderPage(entry = '/automations') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <AutomationsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

async function ruleRow(name: RegExp): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name });
  const row = link.closest('li');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('AutomationsPage', () => {
  it('lists the rules with what each one watches and what it does', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: /Overdue work becomes one signal/ })).toBeDefined();
    expect(screen.getByText(/no rule can publish, send, or call an external system/i)).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Run now' }).length).toBeGreaterThan(0);
  });

  it('writes a run to the log and a signal to the inbox when a rule applies', async () => {
    renderPage();
    const row = await ruleRow(/Overdue work becomes one signal/);
    fireEvent.click(within(row).getByRole('button', { name: 'Run now' }));

    await waitFor(async () => {
      expect(await db.automationRuns.where('ruleId').equals('aut-overdue-tasks').count()).toBe(2);
    });
    const runs = await db.automationRuns.where('ruleId').equals('aut-overdue-tasks').toArray();
    const written = runs.find((run) => run.id !== 'run-overdue-tasks');
    expect(written?.outcome).toBe('applied');
    expect(written?.notificationId).toBeDefined();
    expect(await db.notifications.get(written?.notificationId ?? '')).toBeDefined();
  });

  it('stops a gated rule at the Approval Queue instead of writing the signal', async () => {
    renderPage();
    const row = await ruleRow(/Content dated today/);
    fireEvent.click(within(row).getByRole('button', { name: 'Run now' }));

    await waitFor(async () => {
      expect(await db.automationRuns.where('ruleId').equals('aut-content-today').count()).toBe(2);
    });
    const run = (await db.automationRuns.where('ruleId').equals('aut-content-today').toArray()).find(
      (candidate) => candidate.id !== 'run-content-today',
    );
    expect(run?.outcome).toBe('gated');
    expect(run?.notificationId).toBeUndefined();

    const approval = await db.approvals.get(run?.approvalId ?? '');
    expect(approval?.status).toBe('pending');
    expect(approval?.automationRunId).toBe(run?.id);
    expect(screen.getAllByText('Waiting on a gate').length).toBeGreaterThan(1);
  });

  it('refuses the hand-off rule and names the connector that would have to carry it', async () => {
    renderPage('/automations?state=all');
    const row = await ruleRow(/Publish fan-out through n8n/);
    expect(within(row).getByText('Cannot run')).toBeDefined();
    fireEvent.click(within(row).getByRole('button', { name: 'Record the refusal' }));

    await waitFor(async () => {
      expect(await db.automationRuns.where('ruleId').equals('aut-publish-fanout').count()).toBe(2);
    });
    const run = (
      await db.automationRuns.where('ruleId').equals('aut-publish-fanout').toArray()
    ).find((candidate) => candidate.id !== 'run-publish-fanout');
    expect(run?.outcome).toBe('refused');
    expect(run?.detail).toContain('n8n');
    expect(run?.matched).toBe(0);
  });

  it('turns a rule off and records a run against it as refused', async () => {
    renderPage('/automations?state=all');
    const row = await ruleRow(/Overdue calls become a signal/);
    fireEvent.click(within(row).getByRole('button', { name: 'Disable' }));

    await waitFor(async () => {
      expect((await db.automations.get('aut-decision-calls'))?.enabled).toBe(false);
    });
    expect((await db.automations.get('aut-decision-calls'))?.touchedAt).toBeDefined();

    fireEvent.click(
      within(await ruleRow(/Overdue calls become a signal/)).getByRole('button', {
        name: 'Record the refusal',
      }),
    );
    await waitFor(async () => {
      const runs = await db.automationRuns.where('ruleId').equals('aut-decision-calls').toArray();
      expect(runs.some((run) => run.outcome === 'refused' && run.reason === 'disabled')).toBe(true);
    });
  });

  it('defines a new rule gated by default', async () => {
    renderPage();
    await screen.findByRole('link', { name: /Overdue work becomes one signal/ });

    fireEvent.change(screen.getByLabelText('Define a rule'), {
      target: { value: 'Watch the research queue' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'New rule' }));

    expect(await screen.findByText(/It is enabled and gated/)).toBeDefined();
    const rule = (await db.automations.toArray()).find(
      (candidate) => candidate.name === 'Watch the research queue',
    );
    expect(rule?.requiresApproval).toBe(true);
    expect(rule?.enabled).toBe(true);
    expect(rule?.source).toBe('local');
    expect(rule?.runCount).toBe(0);
  });

  it('filters to the rules that cannot run', async () => {
    renderPage('/automations?state=blocked');

    expect(await screen.findByRole('link', { name: /Publish fan-out through n8n/ })).toBeDefined();
    expect(screen.queryByRole('link', { name: /Overdue work becomes one signal/ })).toBeNull();
  });

  it('runs every enabled rule in one pass and reports what each did', async () => {
    renderPage();
    await screen.findByRole('link', { name: /Overdue work becomes one signal/ });
    const before = await db.automationRuns.count();

    fireEvent.click(screen.getByRole('button', { name: 'Run every enabled rule' }));

    expect(await screen.findByText(/rules run:.*applied.*waiting on a gate/)).toBeDefined();
    await waitFor(async () => {
      expect(await db.automationRuns.count()).toBeGreaterThan(before);
    });
    // The disabled rule is not swept into the pass.
    const runs = await db.automationRuns.where('ruleId').equals('aut-research-due').count();
    expect(runs).toBe(0);
  });
});

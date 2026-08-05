import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { AutomationRulePage } from './AutomationRulePage';

function renderRule(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/automations/rule/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/automations/rule/:id" element={<AutomationRulePage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

function panel(title: string | RegExp): HTMLElement {
  const node = screen.getByText(title).closest('section');
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('AutomationRulePage', () => {
  it('shows what the rule watches as a count of matching records, not a forecast', async () => {
    renderRule('aut-overdue-tasks');

    expect(await screen.findByText('Overdue work becomes one signal')).toBeDefined();
    expect(within(panel('What it watches')).getByText(/This is a count, not a forecast/)).toBeDefined();
    expect(
      within(panel('What it watches')).getByRole('link', { name: 'Open the surface it watches' }).getAttribute('href'),
    ).toBe('/tasks?status=open');
  });

  it('says an ungated rule writes locally and that nothing runs on a timer', async () => {
    renderRule('aut-overdue-tasks');
    await screen.findByText('Overdue work becomes one signal');

    const does = panel('What it does');
    expect(within(does).getByText(/Not gated/)).toBeDefined();
    expect(within(does).getByText(/Everything it writes stays in this browser/)).toBeDefined();
    expect(within(does).getByText(/There is no scheduler on this surface/)).toBeDefined();
  });

  it('says the hand-off rule cannot run and does not evaluate its trigger', async () => {
    renderRule('aut-publish-fanout');

    expect(await screen.findByText('Publish fan-out through n8n')).toBeDefined();
    expect(screen.getByText('Cannot run')).toBeDefined();
    expect(within(panel('What it watches')).getByText('Not evaluated.')).toBeDefined();
    expect(
      within(panel('What it does')).getByText(/There is no connector client here/),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Record the refusal' })).toBeDefined();
  });

  it('shows the gate a run is waiting on and links to the queue', async () => {
    renderRule('aut-stalled-deals');
    await screen.findByText('Stalled opportunity needs a decision');

    const log = panel(/Run log/);
    expect(within(log).getByText('Waiting on a gate')).toBeDefined();
    expect(within(log).getByText(/gate pending/)).toBeDefined();
    expect(within(log).getByRole('link', { name: 'Approval Queue' }).getAttribute('href')).toBe(
      '/approvals',
    );
  });

  it('archives a rule without deleting its run log', async () => {
    renderRule('aut-credential-watch');
    await screen.findByText('Credential gap watch');
    const runs = await db.automationRuns.where('ruleId').equals('aut-credential-watch').count();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(await screen.findByText(/its runs stay in the record/)).toBeDefined();
    await waitFor(async () => {
      expect((await db.automations.get('aut-credential-watch'))?.archivedAt).toBeDefined();
    });
    expect((await db.automations.get('aut-credential-watch'))?.enabled).toBe(false);
    expect(await db.automationRuns.where('ruleId').equals('aut-credential-watch').count()).toBe(runs);
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeDefined();
  });

  it('runs the rule from the detail page and records what it did', async () => {
    renderRule('aut-decision-calls');
    await screen.findByText('Overdue calls become a signal');

    fireEvent.click(screen.getByRole('button', { name: 'Run now' }));

    expect(await screen.findByText(/^Applied\./)).toBeDefined();
    await waitFor(async () => {
      expect(await db.automationRuns.where('ruleId').equals('aut-decision-calls').count()).toBe(2);
    });
  });

  it('says an unknown id is not in the store', async () => {
    renderRule('aut-nothing');
    expect(await screen.findByText('Not in the local store')).toBeDefined();
  });
});

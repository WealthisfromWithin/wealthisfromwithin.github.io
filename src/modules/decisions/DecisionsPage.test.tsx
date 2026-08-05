import 'fake-indexeddb/auto';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { DecisionPage } from './DecisionPage';
import { DecisionsPage } from './DecisionsPage';

const PROPOSED = 'Bring in an editor for the essay cadence';
const OVERDUE = 'Drop the lead-enrichment vendors from the roadmap';
const DECIDED = 'Hold the retainer rate; cut scope instead of price';

function renderPage(element: ReactElement, entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>{element}</AppProviders>
    </MemoryRouter>,
  );
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/decisions/entry/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/decisions/entry/:id" element={<DecisionPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

function rowFor(title: string): HTMLElement {
  const row = screen.getByText(title).closest('li');
  if (!row) throw new Error(`No decision row for ${title}`);
  return row;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('DecisionsPage', () => {
  it('leads with the calls nobody has made and flags the overdue one', async () => {
    renderPage(<DecisionsPage />, '/decisions');

    expect(await screen.findByText(OVERDUE)).toBeDefined();
    expect(within(rowFor(OVERDUE)).getByText('Past its date')).toBeDefined();
    expect(within(rowFor(PROPOSED)).getByText('Awaiting a call')).toBeDefined();
  });

  it('links each row to the record route the allowlist serves', async () => {
    renderPage(<DecisionsPage />, '/decisions');
    await screen.findByText(OVERDUE);

    expect(screen.getByText(OVERDUE).getAttribute('href')).toBe(
      '/decisions/entry/dec-drop-enrichment',
    );
  });

  it('marks a one-way door, because it needs more deliberation than a reversible call', async () => {
    renderPage(<DecisionsPage />, '/decisions');
    await screen.findByText(DECIDED);

    expect(within(rowFor(DECIDED)).getByText('One-way')).toBeDefined();
  });

  it('keeps superseded history off the open view and shows it under All', async () => {
    renderPage(<DecisionsPage />, '/decisions');
    await screen.findByText(OVERDUE);
    expect(screen.queryByText('Publish twice a week')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(await screen.findByText('Publish twice a week')).toBeDefined();
  });

  it('logs a new decision as awaiting a call rather than as decided', async () => {
    renderPage(<DecisionsPage />, '/decisions');
    await screen.findByText(OVERDUE);

    fireEvent.change(screen.getByLabelText('Log a decision'), {
      target: { value: 'Raise the retainer floor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'New decision' }));

    await waitFor(() => {
      expect(screen.getByText('Raise the retainer floor')).toBeDefined();
    });
    expect(within(rowFor('Raise the retainer floor')).getByText('Awaiting a call')).toBeDefined();
  });
});

describe('DecisionPage', () => {
  it('refuses to record a call without both the choice and the reasoning', async () => {
    renderDetail('dec-editor-hire');

    expect(await screen.findByRole('heading', { level: 1, name: PROPOSED })).toBeDefined();
    const record = screen.getByRole('button', { name: 'Record the decision' });
    expect(record.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('What was chosen'), {
      target: { value: 'Hire a part-time editor' },
    });
    expect(record.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Why'), {
      target: { value: 'The second draft is the bottleneck.' },
    });
    expect(record.hasAttribute('disabled')).toBe(false);
  });

  it('records the call and keeps the reasoning with it', async () => {
    renderDetail('dec-editor-hire');
    await screen.findByRole('heading', { level: 1, name: PROPOSED });

    fireEvent.change(screen.getByLabelText('What was chosen'), {
      target: { value: 'Hire a part-time editor' },
    });
    fireEvent.change(screen.getByLabelText('Why'), {
      target: { value: 'The second draft is the bottleneck.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record the decision' }));

    const panel = await screen.findByText('What was chosen, and why');
    const section = panel.closest('section');
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText('Hire a part-time editor')).toBeDefined();
    expect(
      within(section as HTMLElement).getByText('The second draft is the bottleneck.'),
    ).toBeDefined();
  });

  it('says plainly when nothing was weighed', async () => {
    renderDetail('dec-drop-enrichment');
    await screen.findByRole('heading', { level: 1, name: OVERDUE });

    expect(screen.getByText('Keep one for a trial quarter')).toBeDefined();
  });

  it('shows both ends of a supersession', async () => {
    renderDetail('dec-weekly-cadence');
    await screen.findByRole('heading', { level: 1, name: 'Publish twice a week' });

    expect(screen.getByText('Replaced by')).toBeDefined();
    expect(screen.getByText('Record publishes by hand rather than claim a connector')).toBeDefined();
    // Closed history stays closed: no reopen or withdraw is offered.
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('says the record is missing rather than rendering an empty page', async () => {
    renderDetail('dec-nope');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Not in the local store' }),
    ).toBeDefined();
  });
});

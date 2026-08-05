import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { ResearchPage } from './ResearchPage';

const OVERDUE = 'Which phrases must never appear in advisory copy in this jurisdiction?';
const ACTIVE = 'Which firm size actually renews, and which only signs?';
const ANSWERED = 'Does the carousel outperform the long post for this audience?';

function renderPage(entry = '/research') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <ResearchPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

function rowFor(question: string): HTMLElement {
  const row = screen.getByText(question).closest('li');
  if (!row) throw new Error(`No research row for ${question}`);
  return row;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('ResearchPage', () => {
  it('says nothing fetches an answer, because nothing does', async () => {
    renderPage();

    expect(await screen.findByText(/no crawler and no\s+search connector/i)).toBeDefined();
  });

  it('shows only open questions by default, with the overdue one flagged', async () => {
    renderPage();

    expect(await screen.findByText(OVERDUE)).toBeDefined();
    expect(within(rowFor(OVERDUE)).getByText('Overdue')).toBeDefined();
    expect(screen.queryByText(ANSWERED)).toBeNull();
  });

  it('shows the findings recorded by hand, with the source the operator typed', async () => {
    renderPage();
    await screen.findByText(ACTIVE);

    fireEvent.click(screen.getByRole('button', { name: ACTIVE }));

    expect(
      await within(rowFor(ACTIVE)).findByText(/Both renewals came from firms with a named/),
    ).toBeDefined();
    expect(within(rowFor(ACTIVE)).getAllByText(/Local CRM records/).length).toBeGreaterThan(0);
  });

  it('renders a typed source as text rather than as a link', async () => {
    renderPage();
    await screen.findByText(ACTIVE);
    fireEvent.click(screen.getByRole('button', { name: ACTIVE }));

    const sources = await within(rowFor(ACTIVE)).findAllByText(/Local CRM records/);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.closest('a')).toBeNull();
    }
  });

  it('makes a queued question active as soon as a finding is recorded', async () => {
    renderPage();
    await screen.findByText(OVERDUE);
    fireEvent.click(screen.getByRole('button', { name: OVERDUE }));

    fireEvent.change(await within(rowFor(OVERDUE)).findByLabelText(`Finding for ${OVERDUE}`), {
      target: { value: 'The regulator publishes a prohibited-phrase list.' },
    });
    fireEvent.click(within(rowFor(OVERDUE)).getByRole('button', { name: 'Record finding' }));

    await waitFor(() => {
      expect(within(rowFor(OVERDUE)).getByText('In progress')).toBeDefined();
    });
  });

  it('records an answer in the operator’s own words', async () => {
    renderPage();
    await screen.findByText(OVERDUE);
    fireEvent.click(screen.getByRole('button', { name: OVERDUE }));

    fireEvent.change(await within(rowFor(OVERDUE)).findByLabelText(`Answer for ${OVERDUE}`), {
      target: { value: 'Guaranteed, risk-free, and outperform.' },
    });
    fireEvent.click(within(rowFor(OVERDUE)).getByRole('button', { name: 'Answer it' }));

    expect(await screen.findByText(/Answered, in your words/)).toBeDefined();
  });

  it('queues a new question with no findings and no answer', async () => {
    renderPage();
    await screen.findByText(OVERDUE);

    fireEvent.change(screen.getByLabelText('Ask a question'), {
      target: { value: 'What does an audit cost to deliver?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Queue the question' }));

    expect(await screen.findByText(/Nothing will fetch an answer for it/)).toBeDefined();
    const row = rowFor('What does an audit cost to deliver?');
    expect(within(row).getByText('Queued')).toBeDefined();
    expect(within(row).getByText('0 findings')).toBeDefined();
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { MemoryPage } from './MemoryPage';

const CONSTRAINT = 'Never discount the retainer. Reduce scope instead.';
const STALE = 'A paused engagement goes cold in about three weeks without a result to send.';
const RETIRED = 'Offer an introductory rate for the first quarter.';

function renderPage(entry = '/memory') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <MemoryPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

function rowFor(statement: string): HTMLElement {
  const row = screen.getByText(statement).closest('li');
  if (!row) throw new Error(`No memory row for ${statement}`);
  return row;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('MemoryPage', () => {
  it('keeps retired memories out of the working set', async () => {
    renderPage();

    expect(await screen.findByText(CONSTRAINT)).toBeDefined();
    expect(screen.queryByText(RETIRED)).toBeNull();
  });

  it('prints provenance rather than a confidence score nobody measured', async () => {
    renderPage();
    await screen.findByText(CONSTRAINT);

    expect(within(rowFor(CONSTRAINT)).getByText('Stated')).toBeDefined();
    expect(screen.queryByText(/%\s*confidence/i)).toBeNull();
  });

  it('asks about a memory whose review date has passed', async () => {
    renderPage('/memory?state=review');

    expect(await screen.findByText(STALE)).toBeDefined();
    expect(within(rowFor(STALE)).getByRole('button', { name: 'Still true' })).toBeDefined();
  });

  it('pushes the review date out when the memory is re-confirmed', async () => {
    renderPage('/memory?state=review');
    await screen.findByText(STALE);

    fireEvent.click(within(rowFor(STALE)).getByRole('button', { name: 'Still true' }));

    expect(await screen.findByText(/next review is 90 days out/i)).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText(STALE)).toBeNull();
    });
  });

  it('records a recall rather than silently reading', async () => {
    renderPage();
    await screen.findByText(CONSTRAINT);
    expect(within(rowFor(CONSTRAINT)).getByText(/recalled 4/)).toBeDefined();

    fireEvent.click(within(rowFor(CONSTRAINT)).getByRole('button', { name: 'Recall' }));

    await waitFor(() => {
      expect(within(rowFor(CONSTRAINT)).getByText(/recalled 5/)).toBeDefined();
    });
  });

  it('retires rather than deletes, and can restore', async () => {
    renderPage('/memory?state=retired');

    expect(await screen.findByText(RETIRED)).toBeDefined();
    fireEvent.click(within(rowFor(RETIRED)).getByRole('button', { name: 'Restore' }));

    expect(await screen.findByText(/Restored to the working set/i)).toBeDefined();
  });

  it('saves a memory as local, so it survives the demo opt-out', async () => {
    renderPage();
    await screen.findByText(CONSTRAINT);

    fireEvent.change(screen.getByLabelText('Save a memory'), {
      target: { value: 'Dana replies fastest on Tuesdays' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));

    expect(await screen.findByText(/survives a reseed and the demo opt-out/i)).toBeDefined();
    const row = rowFor('Dana replies fastest on Tuesdays');
    expect(within(row).queryByText('Demo')).toBeNull();
  });
});

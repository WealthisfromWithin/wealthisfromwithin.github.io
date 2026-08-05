import 'fake-indexeddb/auto';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { ContentPage } from './ContentPage';
import { ContentIdeasPage } from './ContentIdeasPage';

const DRAFT = 'Why your stack is not a system';
const IN_REVIEW = 'The Compounding Constraint';

function renderPage(element: ReactElement, entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>{element}</AppProviders>
    </MemoryRouter>,
  );
}

function rowFor(title: string): HTMLElement {
  const row = screen.getByText(title).closest('li');
  if (!row) throw new Error(`No queue row for ${title}`);
  return row;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('ContentPage', () => {
  it('lists the production queue with the package each row opens', async () => {
    renderPage(<ContentPage />, '/content');

    expect(await screen.findByText(DRAFT)).toBeDefined();
    expect(
      within(rowFor(DRAFT))
        .getByRole('link', { name: 'Open' })
        .getAttribute('href'),
    ).toBe('/content/item/c-substrate');
    expect(screen.getByRole('heading', { name: 'Content OS' })).toBeDefined();
  });

  it('says publishing is manual rather than implying a connector runs it', async () => {
    renderPage(<ContentPage />, '/content');
    await screen.findByText(DRAFT);

    expect(
      screen.getByText(/publishing is recorded by hand, because no publishing connector/i),
    ).toBeDefined();
  });

  it('keeps published work out of the active queue and shows it under its own filter', async () => {
    renderPage(<ContentPage />, '/content');
    await screen.findByText(DRAFT);
    expect(screen.queryByText('Compounding beats intensity')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Published \d/ }));

    expect(await screen.findByText('Compounding beats intensity')).toBeDefined();
    expect(screen.queryByText(DRAFT)).toBeNull();
  });

  it('filters the queue by format', async () => {
    renderPage(<ContentPage />, '/content?format=short');

    expect(await screen.findByText('Compounding beats intensity — 40 second cut')).toBeDefined();
    expect(screen.queryByText(DRAFT)).toBeNull();
  });

  it('opens a real gate in the Approval Queue when a draft is submitted', async () => {
    renderPage(<ContentPage />, '/content');
    await screen.findByText(DRAFT);

    fireEvent.click(within(rowFor(DRAFT)).getByRole('button', { name: 'Submit for review' }));

    await waitFor(async () => {
      expect((await db.contentItems.get('c-substrate'))?.status).toBe('in_review');
    });
    expect((await db.approvals.get('apr-content-c-substrate'))?.status).toBe('pending');
    expect(await screen.findByText(/Written to the local store/)).toBeDefined();
  });

  it('runs the compliance check on approve and refuses blocking copy in place', async () => {
    await db.contentItems.update('c-constraint', {
      body: 'A risk-free way to double your revenue.',
    });

    renderPage(<ContentPage />, '/content');
    await screen.findByText(IN_REVIEW);

    fireEvent.click(within(rowFor(IN_REVIEW)).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText(/blocking language/i)).toBeDefined();
    expect((await db.contentItems.get('c-constraint'))?.status).toBe('in_review');
  });

  it('shows a blocked item with the reason recorded on it', async () => {
    renderPage(<ContentPage />, '/content?status=blocked');

    expect(await screen.findByText('Quiet operations: the anti-dashboard')).toBeDefined();
    expect(screen.getByText('Publishing webhook has no credentials.')).toBeDefined();
  });
});

describe('ContentIdeasPage', () => {
  it('ranks the vault by the score it prints the inputs for', async () => {
    renderPage(<ContentIdeasPage />, '/content/ideas');

    expect(await screen.findByText('Leverage inventory: what actually compounds')).toBeDefined();
    expect(screen.getByText('6.7')).toBeDefined();
    expect(screen.getAllByText(/^reach \d$/).length).toBeGreaterThan(0);
  });

  it('captures an operator-owned idea from the form', async () => {
    renderPage(<ContentIdeasPage />, '/content/ideas');
    await screen.findByText('Leverage inventory: what actually compounds');

    fireEvent.change(screen.getByLabelText('Capture'), {
      target: { value: 'What a second sale sounds like' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('What a second sale sounds like')).toBeDefined();
    const captured = (await db.contentIdeas.toArray()).find(
      (idea) => idea.title === 'What a second sale sounds like',
    );
    expect(captured?.source).toBe('local');
    expect(captured?.touchedAt).toBeDefined();
  });

  it('refuses an empty capture', async () => {
    renderPage(<ContentIdeasPage />, '/content/ideas');
    await screen.findByText('Leverage inventory: what actually compounds');

    const before = await db.contentIdeas.count();
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true);
    expect(await db.contentIdeas.count()).toBe(before);
  });

  it('promotes an idea into a draft and drops it out of the vault', async () => {
    renderPage(<ContentIdeasPage />, '/content/ideas');
    const idea = await screen.findByText('Leverage inventory: what actually compounds');
    const row = idea.closest('li');

    fireEvent.click(within(row!).getByRole('button', { name: 'Promote to draft' }));

    expect(await screen.findByText(/is now a draft in the production queue/)).toBeDefined();
    await waitFor(async () => {
      expect((await db.contentIdeas.get('idea-leverage-inventory'))?.status).toBe('promoted');
    });
    await waitFor(() => {
      expect(screen.queryByText('Leverage inventory: what actually compounds')).toBeNull();
    });
  });

  it('shows parked ideas under their own filter', async () => {
    renderPage(<ContentIdeasPage />, '/content/ideas?status=parked');

    expect(await screen.findByText('AI theatre and what replaces it')).toBeDefined();
  });
});

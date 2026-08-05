import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { KnowledgeNodePage } from './KnowledgeNodePage';
import { KnowledgePage } from './KnowledgePage';

const PINNED = 'Compounding beats intensity in advisory sales';
const PLAIN = 'How TruOak decides';

function renderList(entry = '/knowledge') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <KnowledgePage />
      </AppProviders>
    </MemoryRouter>,
  );
}

function renderNode(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/knowledge/node/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/knowledge/node/:id" element={<KnowledgeNodePage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('KnowledgePage', () => {
  it('leads with the pinned nodes and links each to its record route', async () => {
    renderList();

    const first = await screen.findByText(PINNED);
    expect(first.getAttribute('href')).toBe('/knowledge/node/kn-compounding-thesis');
    const row = first.closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Pinned')).toBeDefined();
  });

  it('badges seeded rows as demo', async () => {
    renderList();
    await screen.findByText(PINNED);

    expect(screen.getAllByTitle('Seeded demo record. Not operational truth.').length).toBeGreaterThan(
      0,
    );
  });

  it('filters by kind from the query string', async () => {
    renderList('/knowledge?view=all&kind=question');

    expect(await screen.findByText('Is the retainer floor still right at this demand?')).toBeDefined();
    expect(screen.queryByText(PLAIN)).toBeNull();
  });

  it('captures a node as local rather than demo', async () => {
    renderList();
    await screen.findByText(PINNED);

    fireEvent.change(screen.getByLabelText('Capture what you learned'), {
      target: { value: 'Advisors read on Sunday evenings' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }));

    await waitFor(() => {
      expect(screen.getByText('Advisors read on Sunday evenings')).toBeDefined();
    });
    const row = screen.getByText('Advisors read on Sunday evenings').closest('li');
    expect(within(row as HTMLElement).queryByText('Demo')).toBeNull();
  });
});

describe('KnowledgeNodePage', () => {
  it('renders the body as text blocks and the records it is about', async () => {
    renderNode('kn-compounding-thesis');

    expect(await screen.findByRole('heading', { level: 1, name: PINNED })).toBeDefined();
    expect(screen.getByText(/Every closed retainer in the last year/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Dana Aldridge' }).getAttribute('href')).toBe(
      '/crm/person/p-aldridge',
    );
    expect(screen.getByRole('link', { name: 'TruOak renewal framing memo' }).getAttribute('href')).toBe(
      '/documents/doc/doc-truoak-renewal-memo',
    );
  });

  it('archives without deleting, and says the node is still in the record', async () => {
    renderNode('kn-truoak-decision-style');
    await screen.findByRole('heading', { level: 1, name: PLAIN });

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(await screen.findByText(/It stays in the record/)).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('Archived')).toBeDefined();
    });
  });

  it('says the record is missing rather than rendering an empty page', async () => {
    renderNode('kn-nope');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Not in the local store' }),
    ).toBeDefined();
  });
});

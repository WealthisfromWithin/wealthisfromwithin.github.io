import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { createDocument } from '@/data/mutations';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { DocumentPage } from './DocumentPage';
import { DocumentsPage } from './DocumentsPage';

const DRAFT = 'Advisory intake SOP';
const FINAL = 'TruOak renewal framing memo';

function renderList(entry = '/documents') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <DocumentsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

function renderDocument(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/documents/doc/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/documents/doc/:id" element={<DocumentPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('DocumentsPage', () => {
  it('lists documents with the record route each row opens', async () => {
    renderList();

    expect((await screen.findByText(DRAFT)).getAttribute('href')).toBe(
      '/documents/doc/doc-advisory-sop',
    );
  });

  it('filters by kind from the query string', async () => {
    renderList('/documents?status=all&kind=proposal');

    expect(await screen.findByText('Harbour & Vale audit proposal')).toBeDefined();
    expect(screen.queryByText(DRAFT)).toBeNull();
  });

  it('creates a draft rather than pretending to hold a body it was not given', async () => {
    renderList();
    await screen.findByText(DRAFT);

    fireEvent.change(screen.getByLabelText('Start a document'), {
      target: { value: 'Q3 pricing note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));

    await waitFor(() => {
      expect(screen.getByText('Q3 pricing note')).toBeDefined();
    });
    const row = screen.getByText('Q3 pricing note').closest('li');
    expect(within(row as HTMLElement).getByText('Draft')).toBeDefined();
    expect(within(row as HTMLElement).getByText('No body written in this store.')).toBeDefined();
  });
});

describe('DocumentPage', () => {
  it('renders markdown affordances as text blocks', async () => {
    renderDocument('doc-truoak-renewal-memo');

    expect(await screen.findByRole('heading', { level: 1, name: FINAL })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Renewal framing' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'What renewal buys' })).toBeDefined();
  });

  it('renders markup in a body as characters, never as markup', async () => {
    const document = await createDocument({
      title: 'Injection probe',
      body: '<script>alert(1)</script>',
    });
    expect(document).not.toBeNull();

    renderDocument(document?.id ?? '');

    expect(await screen.findByText('<script>alert(1)</script>')).toBeDefined();
    expect(window.document.querySelector('script')).toBeNull();
  });

  it('moves a draft to final, and says so', async () => {
    renderDocument('doc-advisory-sop');
    await screen.findByRole('heading', { level: 1, name: DRAFT });

    fireEvent.click(screen.getByRole('button', { name: 'Mark final' }));

    await waitFor(() => {
      expect(screen.getByText('Final')).toBeDefined();
    });
  });

  it('says the record is missing rather than rendering an empty page', async () => {
    renderDocument('doc-nope');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Not in the local store' }),
    ).toBeDefined();
  });
});

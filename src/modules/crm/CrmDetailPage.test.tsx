import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { CompanyDetailPage, PersonDetailPage } from './CrmDetailPage';

function renderPerson(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/crm/person/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/crm/person/:id" element={<PersonDetailPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

function renderCompany(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/crm/company/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/crm/company/:id" element={<CompanyDetailPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('PersonDetailPage', () => {
  it('joins the opportunities, tasks, and meetings that touch the person', async () => {
    renderPerson('p-aldridge');

    expect(await screen.findByRole('heading', { name: 'Dana Aldridge' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'TruOak advisory retainer renewal' })).toBeDefined();
    expect(screen.getByText('Send TruOak renewal framing memo')).toBeDefined();
    expect(screen.getByText('TruOak renewal working session')).toBeDefined();
  });

  it('links onward only through the record href builders', async () => {
    renderPerson('p-aldridge');
    await screen.findByRole('heading', { name: 'Dana Aldridge' });

    expect(screen.getByRole('link', { name: 'TruOak Capital' }).getAttribute('href')).toBe(
      '/crm/company/co-truoak',
    );
    expect(
      screen.getByRole('link', { name: 'TruOak advisory retainer renewal' }).getAttribute('href'),
    ).toBe('/pipeline/opportunity/opp-truoak');
  });

  it('says so plainly when the id is not in the local store', async () => {
    renderPerson('p-nobody');

    expect(await screen.findByText('Not in the local store')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to CRM' }).getAttribute('href')).toBe('/crm');
  });
});

describe('CompanyDetailPage', () => {
  it('rolls the account up from its people and its open value', async () => {
    renderCompany('co-truoak');

    expect(await screen.findByRole('heading', { name: 'TruOak Capital' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Dana Aldridge' }).getAttribute('href')).toBe(
      '/crm/person/p-aldridge',
    );
    expect(screen.getByRole('link', { name: 'TruOak advisory retainer renewal' })).toBeDefined();
  });

  it('says so plainly when the id is not in the local store', async () => {
    renderCompany('co-nobody');

    expect(await screen.findByText('Not in the local store')).toBeDefined();
  });
});

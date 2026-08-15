import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { clearDemoData, ensureSeeded, resetLocalStore } from '@/data/repositories';
import { AnalyticsPage } from './AnalyticsPage';

function renderPage(entry = '/analytics') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <AnalyticsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('AnalyticsPage', () => {
  it('states that nothing observes the operator before showing a single figure', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Analytics' })).toBeDefined();
    expect(screen.getByText(/no page-view beacon, no session recording, and no analytics connector/)).toBeDefined();
  });

  it('counts the store into demo and operator rows', async () => {
    renderPage();
    await screen.findByText(/Recorded activity/);

    const total = Number(screen.getByText('Rows in the store').nextElementSibling?.textContent);
    const demo = Number(screen.getByText('Demo rows').nextElementSibling?.textContent);
    const operator = Number(screen.getByText('Operator rows').nextElementSibling?.textContent);
    expect(demo + operator).toBe(total);
    expect(demo).toBeGreaterThan(0);
  });

  it('draws one bar per day and says a quiet day is not an empty day', async () => {
    renderPage();
    const panel = (await screen.findByText(/Recorded activity/)).closest('section');

    expect(within(panel as HTMLElement).getAllByTitle(/recorded$/)).toHaveLength(14);
    expect(within(panel as HTMLElement).getByText(/not the same as a day nothing happened/)).toBeDefined();
  });

  it('gives every loop reading the sentence it was counted from', async () => {
    renderPage();
    const panel = (await screen.findByText(/Loop outcomes/)).closest('section');
    const readings = within(panel as HTMLElement).getAllByRole('listitem');

    expect(readings.length).toBeGreaterThanOrEqual(6);
    expect(
      within(panel as HTMLElement).getByText(/refusal is the expected outcome/),
    ).toBeDefined();
    expect(
      within(panel as HTMLElement).getByText(/Publishing is recorded by hand on this surface/),
    ).toBeDefined();
  });

  it('separates rows created from rows the operator touched', async () => {
    renderPage();
    const panel = (await screen.findByText(/Throughput by surface/)).closest('section');

    expect(within(panel as HTMLElement).getByText('Created')).toBeDefined();
    expect(within(panel as HTMLElement).getByText('Touched')).toBeDefined();
    expect(within(panel as HTMLElement).getByText(/a demo reseed will not overwrite/)).toBeDefined();
    expect(
      within(panel as HTMLElement).getByRole('link', { name: 'Automation runs' }).getAttribute('href'),
    ).toBe('/automations');
  });

  it('narrows the window from the query string and back again', async () => {
    renderPage('/analytics?window=7d');
    expect(await screen.findByText(/Where the work happened · 7 days/)).toBeDefined();

    const events = () =>
      Number(screen.getByText('Events in window').nextElementSibling?.textContent);
    const week = events();

    fireEvent.click(screen.getByRole('button', { name: 'All recorded' }));
    await waitFor(() => {
      expect(events()).toBeGreaterThanOrEqual(week);
    });
    expect(screen.getByText(/Where the work happened · All recorded/)).toBeDefined();
  });

  it('reads a demo-free store as unused rather than as zero traffic', async () => {
    await clearDemoData(db);
    renderPage();

    expect(await screen.findByText('No activity was recorded in this window.')).toBeDefined();
    expect(screen.getByText(/nothing recorded in this range/)).toBeDefined();
    // The opt-out holds: the page does not reseed itself to look populated.
    expect(screen.queryByText(/of the rows behind these figures are demo data/)).toBeNull();
  });
});

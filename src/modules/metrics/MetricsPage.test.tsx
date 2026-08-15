import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { MetricsPage } from './MetricsPage';

function renderPage(entry = '/metrics') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <MetricsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

function card(label: string): HTMLElement {
  const node = screen.getByText(label).closest('li');
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('MetricsPage', () => {
  it('says what revenue means here before printing a currency figure', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Business Metrics' })).toBeDefined();
    await screen.findByText('Revenue and pipeline');
    expect(
      screen.getByText(/no accounting system, payment processor, or finance API is connected/),
    ).toBeDefined();
    expect(screen.getByText(/nothing on this page is a profit-and-loss statement/)).toBeDefined();
  });

  it('groups the KPIs and keeps declared figures in their own group', async () => {
    renderPage();
    await screen.findByText('Revenue and pipeline');

    for (const title of ['Revenue and pipeline', 'Delivery', 'Content throughput', 'Gates and leverage', 'Declared metrics']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeDefined();
    }
    expect(screen.getByText(/Recorded as figures rather than counted from records/)).toBeDefined();
  });

  it('prints the basis and the sample size under every figure', async () => {
    renderPage();
    await screen.findByText('Win rate');

    const row = card('Win rate');
    expect(within(row).getByText(/won against/)).toBeDefined();
    expect(within(row).getByText(/rows behind this figure/)).toBeDefined();
  });

  it('warns when a figure rests on too few rows to read as a trend', async () => {
    renderPage();
    await screen.findByText('Closed-won value');

    expect(screen.getAllByText(/too small to read as a trend/).length).toBeGreaterThan(0);
  });

  it('marks the figures demo rows contributed to', async () => {
    renderPage();
    await screen.findByText('Open pipeline');
    expect(within(card('Open pipeline')).getByText('Demo')).toBeDefined();
  });

  it('refuses a rate over the unbounded window and gives one over a bounded window', async () => {
    renderPage('/metrics?window=90d');
    await screen.findByText('Publishes per week');
    expect(within(card('Publishes per week')).getByText(/spread across \d+ weeks/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'All recorded' }));
    await waitFor(() => {
      expect(within(card('Publishes per week')).getByText(/no fixed length/)).toBeDefined();
    });
    expect(within(card('Publishes per week')).getByText('—')).toBeDefined();
  });

  it('says a rate cannot be taken rather than printing zero', async () => {
    await db.contentMetrics.clear();
    renderPage();

    await screen.findByText('Engagement rate');
    expect(within(card('Engagement rate')).getByText('—')).toBeDefined();
    expect(within(card('Engagement rate')).getByText(/No performance readings/)).toBeDefined();
  });

  it('points at Analytics for how the surface itself was used', async () => {
    renderPage();
    await screen.findByText('Revenue and pipeline');
    expect(screen.getByRole('link', { name: 'Analytics' }).getAttribute('href')).toBe('/analytics');
  });
});

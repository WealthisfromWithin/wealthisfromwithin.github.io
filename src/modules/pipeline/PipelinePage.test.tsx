import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { PipelinePage } from './PipelinePage';

const DEAL = 'TruOak advisory retainer renewal';

function renderPipeline(entry = '/pipeline') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <PipelinePage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('PipelinePage', () => {
  it('lists the open funnel with links onto each record', async () => {
    renderPipeline();

    const deal = await screen.findByRole('link', { name: DEAL });
    expect(deal.getAttribute('href')).toBe('/pipeline/opportunity/opp-truoak');
    expect(screen.getByRole('link', { name: 'TruOak Capital' }).getAttribute('href')).toBe(
      '/crm/company/co-truoak',
    );
  });

  it('hides closed deals from the open filter and shows them under their own', async () => {
    renderPipeline();
    await screen.findByRole('link', { name: DEAL });
    expect(screen.queryByRole('link', { name: 'Ridgeline planning retainer' })).toBeNull();

    renderPipeline('/pipeline?stage=won');
    expect(await screen.findByRole('link', { name: 'Ridgeline planning retainer' })).toBeDefined();
  });

  it('writes a stage move to the local store and stamps when the stage changed', async () => {
    renderPipeline('/pipeline?stage=contacted');
    await screen.findByRole('link', { name: 'Vantage advisory pilot' });

    fireEvent.click(screen.getByRole('button', { name: 'To Engaged' }));

    await waitFor(async () => {
      expect((await db.opportunities.get('opp-vantage'))?.stage).toBe('engaged');
    });
    const moved = await db.opportunities.get('opp-vantage');
    expect(moved?.stageChangedAt).toBeDefined();
    expect(moved?.touchedAt).toBeDefined();
  });

  it('settles a deal marked won and drops it out of the open funnel', async () => {
    renderPipeline();
    await screen.findByRole('link', { name: DEAL });

    const row = screen.getByRole('link', { name: DEAL }).closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(
      Array.from(row!.querySelectorAll('button')).find((button) => button.textContent === 'Won')!,
    );

    await waitFor(async () => {
      expect((await db.opportunities.get('opp-truoak'))?.stage).toBe('won');
    });
    expect((await db.opportunities.get('opp-truoak'))?.probability).toBe(100);
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: DEAL })).toBeNull();
    });
  });
});

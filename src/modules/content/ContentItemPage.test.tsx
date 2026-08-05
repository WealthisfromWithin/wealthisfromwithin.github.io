import 'fake-indexeddb/auto';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { ContentAnalyticsPage } from './ContentAnalyticsPage';
import { ContentCalendarPage } from './ContentCalendarPage';
import { ContentCampaignsPage } from './ContentCampaignsPage';
import { ContentItemPage } from './ContentItemPage';
import { ContentLibraryPage } from './ContentLibraryPage';

function renderItem(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/content/item/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/content/item/:id" element={<ContentItemPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

function renderAt(element: ReactElement, entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>{element}</AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('ContentItemPage', () => {
  it('shows the package with the gate, the hook, and the assets behind it', async () => {
    renderItem('c-constraint');

    expect(await screen.findByRole('heading', { name: 'The Compounding Constraint' })).toBeDefined();
    expect(screen.getByText('In review')).toBeDefined();
    expect(screen.getByRole('link', { name: /Publish "The Compounding Constraint"/ })).toBeDefined();
    expect(screen.getByText(/The constraint nobody names/)).toBeDefined();
    expect(screen.getByText(/Assets: Compounding constraint diagram/)).toBeDefined();
  });

  it('says a publish is awaiting credentials instead of offering one', async () => {
    renderItem('c-advisory-loop');
    await screen.findByRole('heading', { name: 'The advisory loop, drawn once' });

    const publish = screen.getByRole('button', { name: /Publish now — awaiting credentials/ });
    expect(publish.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/It does not call LinkedIn, Facebook/)).toBeDefined();
  });

  it('runs the local check on demand and names what it found', async () => {
    await db.contentItems.update('c-constraint', { body: 'A risk-free way to double your money.' });
    renderItem('c-constraint');
    await screen.findByRole('heading', { name: 'The Compounding Constraint' });

    fireEvent.click(screen.getByRole('button', { name: 'Run compliance check' }));

    expect(await screen.findByText('“risk-free”')).toBeDefined();
    expect(screen.getByText(/one or more blocking/)).toBeDefined();
    expect(screen.getByText(/It does not read regulation/)).toBeDefined();
  });

  it('refuses the approval on blocking copy, then records the override', async () => {
    await db.contentItems.update('c-constraint', { body: 'A risk-free launch.' });
    renderItem('c-constraint');
    await screen.findByRole('heading', { name: 'The Compounding Constraint' });

    fireEvent.click(screen.getByRole('button', { name: 'Run check and approve' }));

    expect(await screen.findByText(/Fix it or override/)).toBeDefined();
    expect((await db.contentItems.get('c-constraint'))?.status).toBe('in_review');

    fireEvent.click(await screen.findByRole('button', { name: 'Approve anyway (recorded)' }));

    await waitFor(async () => {
      expect((await db.contentItems.get('c-constraint'))?.status).toBe('approved');
    });
    expect((await db.contentItems.get('c-constraint'))?.complianceSummary).toContain(
      'operator override',
    );
  });

  it('writes a publish date without queueing anything', async () => {
    renderItem('c-renewal-proof');
    await screen.findByRole('heading', { name: 'What a renewal conversation should sound like' });

    fireEvent.change(screen.getByLabelText('Publish date'), {
      target: { value: '2026-09-01T09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    await waitFor(async () => {
      expect((await db.contentItems.get('c-renewal-proof'))?.status).toBe('scheduled');
    });
    expect((await db.contentItems.get('c-renewal-proof'))?.scheduledFor).toContain('2026-09-01');
  });

  it('reads performance from recorded readings and says so when there are none', async () => {
    renderItem('c-compounding-essay');
    await screen.findByRole('heading', { name: 'Compounding beats intensity' });

    expect(screen.getByText('6,140')).toBeDefined();
    expect(screen.getByText('4.7%')).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Compounding beats intensity — 40 second cut' }),
    ).toBeDefined();
  });

  it('says an item is not here rather than rendering an empty package', async () => {
    renderItem('c-nobody');

    expect(await screen.findByRole('heading', { name: 'Not in the local store' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to the queue' }).getAttribute('href')).toBe(
      '/content',
    );
  });
});

describe('ContentCalendarPage', () => {
  it('places dated work on the week and lists what carries no date', async () => {
    renderAt(<ContentCalendarPage />, '/content/calendar');

    expect(await screen.findByRole('heading', { name: 'Publishing Calendar' })).toBeDefined();
    expect(screen.getByText(/nothing is queued with a provider/i)).toBeDefined();
    expect((await screen.findAllByText('The advisory loop, drawn once')).length).toBeGreaterThan(0);
    expect(screen.getByText('In production with no publish date')).toBeDefined();
  });
});

describe('ContentCampaignsPage', () => {
  it('counts production from the items pointing at each campaign', async () => {
    renderAt(<ContentCampaignsPage />, '/content/campaigns');

    expect(await screen.findByText('Constraint series')).toBeDefined();
    expect(screen.getAllByText(/in production · \d+ published · \d+ idea\(s\)/).length).toBe(
      (await db.campaigns.count()),
    );
  });
});

describe('ContentLibraryPage', () => {
  it('shows the hook library by default, with what each hook is used by', async () => {
    renderAt(<ContentLibraryPage />, '/content/library');

    expect(await screen.findByText('A stack is not a system. Here is the difference, in one workflow.')).toBeDefined();
    expect(screen.queryByText('If the constraint sounds familiar, book thirty minutes.')).toBeNull();
  });

  it('switches library by query rather than by another route', async () => {
    renderAt(<ContentLibraryPage />, '/content/library?type=ctas');

    expect(
      await screen.findByText('If the constraint sounds familiar, book thirty minutes.'),
    ).toBeDefined();
    expect(
      screen.queryByText('A stack is not a system. Here is the difference, in one workflow.'),
    ).toBeNull();
  });
});

describe('ContentAnalyticsPage', () => {
  it('reports what was measured and never invents a number for what was not', async () => {
    renderAt(<ContentAnalyticsPage />, '/content/analytics');

    expect(await screen.findByRole('heading', { name: 'Performance' })).toBeDefined();
    expect(screen.getByText(/No analytics API is connected/)).toBeDefined();
    expect((await screen.findAllByText('LinkedIn')).length).toBeGreaterThan(0);
    expect(screen.getByText(/A window with no reading compares to nothing/)).toBeDefined();
    expect(screen.getAllByText(/reading\(s\)$/).length).toBeGreaterThan(0);
  });
});

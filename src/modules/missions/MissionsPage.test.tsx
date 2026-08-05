import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { MissionPage } from './MissionPage';
import { MissionsPage } from './MissionsPage';

function renderList(entry = '/missions') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <MissionsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/missions/${id}`]}>
      <AppProviders>
        <Routes>
          <Route path="/missions/:id" element={<MissionPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('MissionsPage', () => {
  it('prints the declared and the counted figure side by side', async () => {
    renderList();
    const card = (await screen.findByText('Compound the advisory funnel')).closest('li');
    expect(card).not.toBeNull();

    expect(within(card as HTMLElement).getByText('46%')).toBeDefined();
    expect(within(card as HTMLElement).getByText('Declared')).toBeDefined();
    expect(within(card as HTMLElement).getByText('Counted')).toBeDefined();
    expect(screen.getByText(/never averaged/)).toBeDefined();
  });

  it('names the blocker on a blocked objective', async () => {
    renderList();
    expect(
      await screen.findByText('n8n credentials are not configured for the Command Surface.'),
    ).toBeDefined();
  });

  it('hides a complete objective from the default view and shows it under its filter', async () => {
    await db.missions.update('msn-044', { status: 'complete', progress: 100 });

    renderList();
    await screen.findByText('Compound the advisory funnel');
    expect(screen.queryByText('Institutional memory')).toBeNull();
  });

  it('opens an objective that nothing serves yet, and says so', async () => {
    renderList('/missions?status=all');
    await screen.findByText('Compound the advisory funnel');

    fireEvent.change(screen.getByLabelText('Open an objective'), {
      target: { value: 'Ship the operator handbook' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'New objective' }));

    expect(await screen.findByText(/an objective with nothing pointing at it counts nothing/)).toBeDefined();
    const mission = (await db.missions.toArray()).find(
      (row) => row.title === 'Ship the operator handbook',
    );
    expect(mission?.status).toBe('active');
    expect(mission?.progress).toBe(0);
    expect(mission?.source).toBe('local');
    expect(mission?.touchedAt).toBeDefined();

    const card = (await screen.findByText('Ship the operator handbook')).closest('li');
    expect(within(card as HTMLElement).getByText('Nothing serves it')).toBeDefined();
    expect(within(card as HTMLElement).getByText('Nothing linked to count.')).toBeDefined();
  });
});

describe('MissionPage', () => {
  it('shows the two progress figures with the sentence that separates them', async () => {
    renderDetail('msn-042');

    expect(await screen.findByText('Compound the advisory funnel')).toBeDefined();
    expect(screen.getByText('Declared by the operator')).toBeDefined();
    expect(screen.getByText('Counted from linked tasks')).toBeDefined();
    expect(screen.getByText(/Met when: Eight qualified conversations/)).toBeDefined();
    expect(screen.getByText(/the store is only claiming the second one/)).toBeDefined();
  });

  it('records a declared figure without moving the counted one', async () => {
    renderDetail('msn-042');
    await screen.findByText('Compound the advisory funnel');
    const counted = screen.getByText('Counted from linked tasks').nextElementSibling?.textContent;

    fireEvent.change(screen.getByLabelText('Declare progress'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    expect(await screen.findByText(/The counted figure is unchanged/)).toBeDefined();
    await waitFor(async () => {
      expect((await db.missions.get('msn-042'))?.progress).toBe(90);
    });
    expect(screen.getByText('Counted from linked tasks').nextElementSibling?.textContent).toBe(
      counted,
    );
  });

  it('refuses to mark an objective blocked with no blocker written', async () => {
    renderDetail('msn-042');
    await screen.findByText('Compound the advisory funnel');

    const block = screen.getByRole('button', { name: 'Mark blocked' });
    expect(block.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('What is blocking it'), {
      target: { value: 'The renewal call has not happened.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mark blocked' }));

    await waitFor(async () => {
      expect((await db.missions.get('msn-042'))?.status).toBe('blocked');
    });
    expect((await db.missions.get('msn-042'))?.blockedReason).toBe(
      'The renewal call has not happened.',
    );
  });

  it('carries the blockers of the work beneath it, not just its own', async () => {
    renderDetail('msn-043');

    await screen.findByText('Automate publishing substrate');
    const panel = screen.getByText('What is blocking it').closest('section');
    const blockers = within(panel as HTMLElement).getAllByRole('listitem');

    expect(blockers[0]?.textContent).toBe(
      'n8n credentials are not configured for the Command Surface.',
    );
    expect(blockers.length).toBeGreaterThan(1);
  });

  it('offers no move on a complete objective, because it is history', async () => {
    await db.missions.update('msn-044', { status: 'complete' });
    renderDetail('msn-044');

    expect(await screen.findByText(/A complete objective is history/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Mark/ })).toBeNull();
  });

  it('says an unknown id is not in the store rather than rendering an empty objective', async () => {
    renderDetail('msn-999');
    expect(await screen.findByText('Not in the local store')).toBeDefined();
  });
});

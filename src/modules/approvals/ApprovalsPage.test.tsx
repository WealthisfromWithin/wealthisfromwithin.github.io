import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { ApprovalsPage } from './ApprovalsPage';

function renderQueue(entry = '/approvals') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <ApprovalsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('ApprovalsPage', () => {
  it('shows the open gates with a decision for each', async () => {
    renderQueue();

    expect(await screen.findByText('Send 12-contact re-engagement sequence')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Approve' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Reject' }).length).toBeGreaterThan(0);
  });

  it('writes an approval to the local store and drops it from the pending view', async () => {
    renderQueue();
    await screen.findByText('Send 12-contact re-engagement sequence');

    const approve = screen.getAllByRole('button', { name: 'Approve' })[0];
    expect(approve).toBeDefined();
    fireEvent.click(approve!);

    await waitFor(async () => {
      expect((await db.approvals.get('apr-outreach'))?.status).toBe('approved');
    });
    await waitFor(() => {
      expect(screen.queryByText('Send 12-contact re-engagement sequence')).toBeNull();
    });
  });

  it('lists decided gates under their own filter without action buttons', async () => {
    renderQueue('/approvals?status=rejected');

    expect(
      await screen.findByText('Grant the research agent read access to the CRM export'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Reopen' }).length).toBeGreaterThan(0);
  });
});

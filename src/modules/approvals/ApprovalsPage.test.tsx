import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/**
 * The queue is the only decision surface for a content gate, so a decision made
 * here has to move the copy the gate holds (W4 M1).
 */
describe('ApprovalsPage deciding a content gate', () => {
  const GATE = 'Publish "The Compounding Constraint" to LinkedIn';

  async function gateRow(): Promise<HTMLElement> {
    const title = await screen.findByText(GATE);
    const row = title.closest('li');
    expect(row).not.toBeNull();
    return row as HTMLElement;
  }

  it('approves the content item, not just the gate', async () => {
    renderQueue();
    fireEvent.click(within(await gateRow()).getByRole('button', { name: 'Approve' }));

    await waitFor(async () => {
      expect((await db.contentItems.get('c-constraint'))?.status).toBe('approved');
    });
    expect((await db.approvals.get('apr-linkedin'))?.status).toBe('approved');
    expect((await db.contentItems.get('c-constraint'))?.complianceCheckedAt).toBeDefined();
  });

  it('rejects the copy back to drafting with the gate', async () => {
    renderQueue();
    fireEvent.click(within(await gateRow()).getByRole('button', { name: 'Reject' }));

    await waitFor(async () => {
      expect((await db.approvals.get('apr-linkedin'))?.status).toBe('rejected');
    });
    expect((await db.contentItems.get('c-constraint'))?.status).toBe('drafting');
  });

  it('reopens both halves of a decided gate', async () => {
    await db.contentItems.update('c-constraint', { status: 'approved' });
    await db.approvals.update('apr-linkedin', {
      status: 'approved',
      decidedAt: new Date().toISOString(),
      decidedBy: 'Operator',
    });

    renderQueue('/approvals?status=all');
    fireEvent.click(within(await gateRow()).getByRole('button', { name: 'Reopen' }));

    await waitFor(async () => {
      expect((await db.approvals.get('apr-linkedin'))?.status).toBe('pending');
    });
    expect((await db.contentItems.get('c-constraint'))?.status).toBe('in_review');
  });

  it('refuses blocking copy, then records the override the operator chooses', async () => {
    await db.contentItems.update('c-constraint', {
      body: 'A risk-free way to double your revenue.',
      variants: [],
    });

    renderQueue();
    fireEvent.click(within(await gateRow()).getByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText(/local compliance check found blocking language/i),
    ).toBeDefined();
    expect((await db.contentItems.get('c-constraint'))?.status).toBe('in_review');
    expect((await db.approvals.get('apr-linkedin'))?.status).toBe('pending');

    const override = await screen.findByRole('button', { name: 'Approve anyway (recorded)' });
    expect(screen.getByRole('link', { name: 'Open the package' }).getAttribute('href')).toBe(
      '/content/item/c-constraint',
    );

    fireEvent.click(override);

    await waitFor(async () => {
      expect((await db.contentItems.get('c-constraint'))?.status).toBe('approved');
    });
    expect((await db.contentItems.get('c-constraint'))?.complianceSummary).toContain(
      'operator override',
    );
    expect((await db.approvals.get('apr-linkedin'))?.status).toBe('approved');
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { InboxPage } from './InboxPage';

const UNREAD_SIGNAL = 'Outreach sequence needs approval';
const READ_SIGNAL = 'Weekly learning digest ready';

function renderInbox(entry = '/inbox') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <InboxPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('InboxPage', () => {
  it('opens on unread signals and hides read ones', async () => {
    renderInbox();

    expect(await screen.findByText(UNREAD_SIGNAL)).toBeDefined();
    expect(screen.queryByText(READ_SIGNAL)).toBeNull();
  });

  it('shows read signals under the read filter', async () => {
    renderInbox('/inbox?status=read');

    expect(await screen.findByText(READ_SIGNAL)).toBeDefined();
    expect(screen.queryByText(UNREAD_SIGNAL)).toBeNull();
  });

  it('writes read state to the local store', async () => {
    renderInbox();
    await screen.findByText(UNREAD_SIGNAL);

    const markRead = screen.getAllByRole('button', { name: 'Mark read' })[0];
    expect(markRead).toBeDefined();
    fireEvent.click(markRead!);

    await waitFor(async () => {
      expect((await db.notifications.get('n-approval-outreach'))?.read).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText(UNREAD_SIGNAL)).toBeNull();
    });
  });

  it('marks every signal read from one control', async () => {
    renderInbox();
    await screen.findByText(UNREAD_SIGNAL);

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    await waitFor(async () => {
      const rows = await db.notifications.toArray();
      expect(rows.every((row) => row.read)).toBe(true);
    });
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { TasksPage } from './TasksPage';

const TASK = 'Send TruOak renewal framing memo';

function renderTasks(entry = '/tasks') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <TasksPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('TasksPage', () => {
  it('lists open work with the record each task points at', async () => {
    renderTasks();

    expect(await screen.findByText(TASK)).toBeDefined();
    for (const link of screen.getAllByRole('link', { name: 'Dana Aldridge' })) {
      expect(link.getAttribute('href')).toBe('/crm/person/p-aldridge');
    }
    expect(screen.getAllByRole('button', { name: /^Mark / }).length).toBeGreaterThan(0);
  });

  it('writes a status change to the local store and drops the task from the open list', async () => {
    renderTasks('/tasks?status=in_progress');
    await screen.findByText('Prep Meridian discovery call');

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]!);

    await waitFor(async () => {
      expect((await db.tasks.get('t-meridian-call'))?.status).toBe('done');
    });
    expect((await db.tasks.get('t-meridian-call'))?.completedAt).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByText('Prep Meridian discovery call')).toBeNull();
    });
  });

  it('creates an operator-owned task from the inline form', async () => {
    renderTasks();
    await screen.findByText(TASK);

    fireEvent.change(screen.getByLabelText('New task'), {
      target: { value: 'Call the auditor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Call the auditor')).toBeDefined();
    const created = (await db.tasks.toArray()).find((task) => task.title === 'Call the auditor');
    expect(created?.source).toBe('local');
    expect(created?.touchedAt).toBeDefined();
  });

  it('refuses to submit an empty title', async () => {
    renderTasks();
    await screen.findByText(TASK);

    const before = await db.tasks.count();
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(true);
    expect(await db.tasks.count()).toBe(before);
  });

  it('shows blocked work with the reason recorded on the record', async () => {
    renderTasks('/tasks?status=blocked');

    expect(await screen.findByText('Wire publishing loop to approval gate')).toBeDefined();
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
  });
});

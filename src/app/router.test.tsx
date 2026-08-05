import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { AppProviders } from './providers';
import { enabledModules, enabledRecordRoutes, enabledSubRoutes } from './modules';
import { routes } from './router';

/** One real id per record route, so the detail page has something to render. */
const RECORD_IDS: Record<string, string> = {
  'crm-person': 'p-aldridge',
  'crm-company': 'co-truoak',
  'pipeline-opportunity': 'opp-truoak',
  'content-item': 'c-constraint',
  'knowledge-node': 'kn-compounding-thesis',
  document: 'doc-truoak-renewal-memo',
  decision: 'dec-no-discount',
  'automation-rule': 'aut-overdue-tasks',
  mission: 'msn-042',
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

/** The page inside the shell, once its chunk has arrived and Suspense has cleared. */
async function page() {
  const main = screen.getByRole('main');
  await waitFor(() => {
    expect(within(main).queryByText('Loading module…')).toBeNull();
  });
  return main;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('router', () => {
  it.each(enabledModules().map((module) => [module.path, module.label] as const))(
    'resolves the lazy chunk behind %s',
    async (_path, label) => {
      renderAt(_path);

      expect(within(await page()).getByRole('heading', { level: 1, name: label })).toBeDefined();
    },
  );

  it.each(enabledSubRoutes().map((route) => [route.path, route.label] as const))(
    'resolves the lazy chunk behind the %s sub-route',
    async (path, label) => {
      renderAt(path);

      expect(within(await page()).getByRole('heading', { level: 1, name: label })).toBeDefined();
    },
  );

  it.each(enabledRecordRoutes().map((record) => [record.id, record.pattern] as const))(
    'resolves the lazy chunk behind the %s detail route',
    async (id, pattern) => {
      renderAt(pattern.replace(':id', RECORD_IDS[id] ?? ''));

      const main = within(await page());
      expect(main.queryByText('Not in the local store')).toBeNull();
      expect(main.getByRole('heading', { level: 1 })).toBeDefined();
    },
  );

  it('sends an unrouted path back to the brief rather than a coming-soon page', async () => {
    // `/sync` is the Wave 7 module: planned, so the router serves nothing for it.
    renderAt('/sync');

    expect(
      within(await page()).getByRole('heading', { level: 1, name: 'Morning Brief' }),
    ).toBeDefined();
  });
});

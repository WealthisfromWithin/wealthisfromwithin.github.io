import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { SyncPage } from './SyncPage';

/**
 * The shipped configuration: no `VITE_API_BASE_URL`. The page must make no
 * request at all, and must not read as though a Command API is present.
 */
const fetchStub = vi.hoisted(() => {
  const stub = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
    Promise.reject(new Error('nothing may be requested in this test')),
  );
  vi.stubGlobal('fetch', stub);
  return stub;
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sync']}>
      <AppProviders>
        <SyncPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  fetchStub.mockClear();
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('SyncPage with no Command API configured', () => {
  it('reads Disabled and says why, rather than Connected or Syncing', async () => {
    renderPage();

    expect(await screen.findByText('Disabled')).toBeDefined();
    expect(screen.getByText(/VITE_API_BASE_URL is unset/)).toBeDefined();
    expect(screen.queryByText('Connected')).toBeNull();
    // The page may say a record was never synced; it may never say one was.
    expect(screen.queryByText(/last sync|records synced|sync complete|up to date/i)).toBeNull();
  });

  it('offers a probe button that is off, and fetches nothing on mount', async () => {
    renderPage();

    const button = await screen.findByRole('button', { name: /Probe \/health/ });
    expect(button.getAttribute('disabled')).not.toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('shows the registry row it would write to, never probed', async () => {
    renderPage();

    expect(await screen.findByText('ContentDone API')).toBeDefined();
    expect(screen.getAllByText('never probed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Awaiting Credentials').length).toBeGreaterThan(0);
  });

  it('marks every capability but the health probe as not implemented', async () => {
    renderPage();
    // Twice: the panel that runs the probe, and the capability row for it.
    expect(await screen.findAllByText('Health probe')).toHaveLength(2);

    expect(screen.getAllByText('Not implemented').length).toBeGreaterThan(3);
    expect(screen.getAllByText('Implemented')).toHaveLength(1);
    expect(screen.getByText(/no remote record has ever entered this store/)).toBeDefined();
    expect(screen.getByText(/Every mutation in this surface writes to IndexedDB and stops/)).toBeDefined();
  });

  it('offers no credential field and no sign-in', async () => {
    renderPage();
    await screen.findAllByText('Health probe');

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText(/password|token|key/i)).toBeNull();
    expect(screen.getByText(/there is no account, no token/i)).toBeDefined();
  });
});

describe('SyncPage with a Command API configured', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
  });

  it('probes /health once asked, and records the verified result on the registry row', async () => {
    fetchStub.mockImplementation(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })));
    renderPage();

    const button = await screen.findByRole('button', { name: /Probe \/health/ });
    expect(screen.getAllByText('Awaiting Credentials').length).toBeGreaterThan(0);
    expect(fetchStub).not.toHaveBeenCalled();

    button.click();

    await waitFor(() => {
      expect(screen.getByText(/Probe recorded against the registry row/)).toBeDefined();
    });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchStub.mock.calls[0]?.[0]).toBe('https://api.example.com/health');
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);

    const row = await db.integrations.get('contentdone');
    expect(row?.state).toBe('connected');
    expect(row?.lastProbedAt).toBeDefined();
  });

  it('stays Awaiting Credentials when the endpoint answers badly', async () => {
    fetchStub.mockImplementation(() => Promise.resolve(new Response('nope', { status: 503 })));
    renderPage();

    (await screen.findByRole('button', { name: /Probe \/health/ })).click();

    await waitFor(() => {
      expect(screen.getByText(/did not report itself healthy/)).toBeDefined();
    });
    expect(screen.queryByText('Connected')).toBeNull();
    const row = await db.integrations.get('contentdone');
    expect(row?.state).toBe('awaiting_credentials');
    expect(row?.lastProbedAt).toBeDefined();
  });

  it('records the attempt when the origin cannot be reached at all', async () => {
    fetchStub.mockImplementation(() => Promise.reject(new Error('network down')));
    renderPage();

    (await screen.findByRole('button', { name: /Probe \/health/ })).click();

    await waitFor(() => {
      expect(screen.getByText(/could not be reached/)).toBeDefined();
    });
    expect(screen.queryByText('Connected')).toBeNull();
  });
});

describe('SyncPage with a misconfigured Command API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://operator:s3cret@api.example.com');
  });

  it('refuses a base URL carrying a credential, and never prints the credential', async () => {
    renderPage();

    expect(await screen.findByText('Disabled')).toBeDefined();
    expect(screen.getByText(/carries credentials in the URL/)).toBeDefined();
    expect(document.body.textContent).not.toContain('s3cret');
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

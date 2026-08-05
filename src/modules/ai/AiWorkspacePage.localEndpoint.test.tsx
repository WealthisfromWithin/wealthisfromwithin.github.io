import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { AiWorkspacePage } from './AiWorkspacePage';

/**
 * The build is misconfigured: VITE_LOCAL_AI_URL points at a remote host. The
 * surface must not read as though a local runtime is available, and the page
 * must not cause a single request to that host. Both the stub and the env are
 * installed before the module graph loads, because the kernel singleton reads
 * the environment and captures `fetch` when `@/agents` is first imported.
 */
const fetchStub = vi.hoisted(() => {
  const stub = vi.fn(() => Promise.reject(new Error('nothing may be requested in this test')));
  vi.stubGlobal('fetch', stub);
  vi.stubEnv('VITE_LOCAL_AI_URL', 'https://models.example.com');
  return stub;
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ai']}>
      <AppProviders>
        <AiWorkspacePage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  fetchStub.mockClear();
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('AiWorkspacePage with a non-loopback VITE_LOCAL_AI_URL', () => {
  it('does not imply a usable local runtime', async () => {
    renderPage();

    expect(await screen.findByText(/No adapter can run a turn/i)).toBeDefined();
    expect(screen.getByText('Not configured')).toBeDefined();
    expect(screen.queryByText('Ready')).toBeNull();
    expect(screen.queryByText(/adapters can run a turn:/i)).toBeNull();
    // The composer still offers to record a refusal rather than a completion.
    expect(await screen.findByRole('button', { name: /Send and record the refusal/i })).toBeDefined();
  });

  it('says which host was refused and why, without calling it', async () => {
    renderPage();

    const detail = await screen.findByText(/models\.example\.com/);
    expect(detail.textContent).toContain('loopback');
    expect(detail.textContent).toContain('not this machine');
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

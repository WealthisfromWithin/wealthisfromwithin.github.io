import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { IntegrationsPage } from './IntegrationsPage';

function renderRegistry(entry = '/integrations') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <IntegrationsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

function rowCount(): number {
  return document.querySelectorAll('tbody tr').length;
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('IntegrationsPage', () => {
  it('holds every connector in one of the three states, none of them Connected', async () => {
    renderRegistry();
    await screen.findByRole('heading', { level: 1, name: 'Integrations' });

    await waitFor(() => {
      expect(rowCount()).toBeGreaterThan(10);
    });
    expect(screen.getByText(/no probe exists yet on this surface/)).toBeDefined();
    expect(screen.queryByText(/^Connected$/, { selector: 'span' })).toBeNull();
  });

  it('filters by category from the URL and keeps the state filter alongside it', async () => {
    renderRegistry('/integrations?category=mcp');
    await waitFor(() => {
      expect(rowCount()).toBeGreaterThan(3);
    });
    const mcpRows = rowCount();
    expect(screen.getByText('Sovereign Mind MCP')).toBeDefined();
    expect(screen.queryByText('LinkedIn')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Disabled' }));
    await waitFor(() => {
      expect(rowCount()).toBeLessThan(mcpRows);
    });
    expect(screen.getByText('GitHub MCP Server')).toBeDefined();
    expect(screen.queryByText('Sovereign Mind MCP')).toBeNull();
  });

  it('says which pair of filters matched nothing rather than showing an empty table', async () => {
    renderRegistry('/integrations?state=connected&category=mcp');

    expect(
      await screen.findByText('No connector matches connected in mcp.'),
    ).toBeDefined();
    expect(rowCount()).toBe(0);
  });

  it('reports that a connector was never probed instead of leaving the column blank', async () => {
    renderRegistry('/integrations?category=mcp');
    await waitFor(() => {
      expect(rowCount()).toBeGreaterThan(3);
    });
    expect(screen.getAllByText('never probed').length).toBe(rowCount());
  });

  it('shows the date of a probe when the registry records one', async () => {
    await db.integrations.update('sovereign-mind-mcp', {
      lastProbedAt: '2026-07-04T10:00:00.000Z',
    });
    renderRegistry('/integrations?category=mcp');

    expect(await screen.findByText('probed 2026-07-04')).toBeDefined();
  });

  it('keeps every credential off the page and points at where they live', async () => {
    renderRegistry();
    await waitFor(() => {
      expect(rowCount()).toBeGreaterThan(10);
    });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/api[_-]?key|bearer|secret/i);
    expect(screen.getByText(/Credentials are configured on the Command API/)).toBeDefined();
  });

  it('offers the MCP panel as a lens on the same registry', async () => {
    renderRegistry();
    expect(
      (await screen.findByRole('link', { name: 'MCP Servers' })).getAttribute('href'),
    ).toBe('/integrations/mcp');
  });
});

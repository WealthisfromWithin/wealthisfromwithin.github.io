import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { McpPage } from './McpPage';

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/integrations/mcp']}>
      <AppProviders>
        <McpPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('McpPage', () => {
  it('lists the declared servers with one of the three legal states each', async () => {
    renderPanel();

    const list = (await screen.findByText('Sovereign Mind MCP')).closest('ul');
    const rows = within(list as HTMLElement).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(3);

    const scoped = within(list as HTMLElement);
    expect(scoped.getAllByText('Awaiting Credentials').length).toBeGreaterThan(0);
    expect(scoped.getAllByText('Disabled').length).toBeGreaterThan(0);
    expect(scoped.queryByText('Connected')).toBeNull();
    expect(
      scoped.getAllByText('Awaiting Credentials').length + scoped.getAllByText('Disabled').length,
    ).toBe(rows.length);
  });

  it('says why nothing is connected instead of leaving the reader to guess', async () => {
    renderPanel();

    expect(await screen.findByText(/No MCP server is connected\./)).toBeDefined();
    expect(screen.getByText(/This bundle ships no MCP client/)).toBeDefined();
    expect(screen.getByText(/Show Connected without a verified probe/)).toBeDefined();
    expect(screen.getByText(/Enumerate tools, resources, or prompts/)).toBeDefined();
  });

  it('carries the gap for each server, and never a tool list or a latency', async () => {
    renderPanel();
    const row = (await screen.findByText('Sovereign Mind MCP')).closest('li');

    expect(within(row as HTMLElement).getByText(/It also needs the Command API of Wave 7/)).toBeDefined();
    expect(within(row as HTMLElement).getByText(/never probed/)).toBeDefined();
    expect(screen.queryByText(/healthy/i)).toBeNull();
    expect(screen.queryByText(/\dms/)).toBeNull();
  });

  it('marks a vendor server as somebody else\u2019s and says why it is off', async () => {
    renderPanel();
    const row = (await screen.findByText('GitHub MCP Server')).closest('li');

    expect(within(row as HTMLElement).getByText('vendor')).toBeDefined();
    expect(within(row as HTMLElement).getByText('Disabled')).toBeDefined();
    expect(within(row as HTMLElement).getByText(/Disabled by choice/)).toBeDefined();
  });

  it('shows no credential field, because the panel holds no secret', async () => {
    renderPanel();
    await screen.findByText('Sovereign Mind MCP');

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/Nothing secret belongs in a static bundle/)).toBeDefined();
  });

  it('keeps the registry tabs, so the panel is one view of one registry', async () => {
    renderPanel();
    await screen.findByText('Sovereign Mind MCP');

    const tab = screen.getByRole('link', { name: 'All Connectors' });
    expect(tab.getAttribute('href')).toBe('/integrations');
  });
});

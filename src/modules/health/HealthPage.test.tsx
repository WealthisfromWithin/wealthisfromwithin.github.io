import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SovereignContext, type SovereignContextValue } from '@/app/context';
import type { SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import { HealthPage } from './HealthPage';

const now = new Date('2026-08-05T07:30:00.000Z');

/**
 * A dataset whose substrate rows have been edited the way a hand-edited
 * IndexedDB row or a careless future writer would edit them: `connected`, with
 * nothing to show for it.
 */
function withUnverifiedSubstrate(dataset: SovereignDataset): SovereignDataset {
  return {
    ...dataset,
    integrations: dataset.integrations.map((integration) =>
      integration.substrate
        ? { ...integration, state: 'connected' as const, lastProbedAt: undefined }
        : integration,
    ),
  };
}

function renderHealth(dataset: SovereignDataset = buildDemoDataset(now)) {
  const value: SovereignContextValue = {
    dataset,
    ready: true,
    error: null,
    searchIndex: [],
  };

  return render(
    <MemoryRouter>
      <SovereignContext value={value}>
        <HealthPage />
      </SovereignContext>
    </MemoryRouter>,
  );
}

describe('HealthPage', () => {
  it('states the substrate is offline and that no probe has run', () => {
    renderHealth();

    expect(screen.getByText('offline')).toBeDefined();
    expect(screen.getByText(/No substrate connection is verified/)).toBeDefined();
    expect(screen.getByText(/No health probe has ever run/)).toBeDefined();
  });

  it('never renders a positive health claim', () => {
    const { container } = renderHealth();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/\bhealthy\b/i);
    expect(text).not.toMatch(/all \d+ substrate systems verified/i);
    expect(text).not.toMatch(/\d+ of \d+ substrate systems verified/i);
    expect(screen.queryByText('operational')).toBeNull();
    expect(screen.queryByText('degraded')).toBeNull();
  });

  it('shows the registry counts, including zero connected', () => {
    renderHealth();

    const connected = screen.getByText('Connected').parentElement;
    expect(connected?.textContent).toContain('0');
  });

  /**
   * The connected-probe invariant on a render path
   * (`docs/reviews/WAVE_7_GPT_REVIEW.md` H1). The counts in the header already
   * apply it, so a substrate pill reading the stored field would make this one
   * page contradict itself and show green for an unverified claim.
   */
  it('pills an unverified Connected substrate row as Awaiting Credentials', () => {
    const { container } = renderHealth(withUnverifiedSubstrate(buildDemoDataset(now)));

    const rows = container.querySelectorAll('section[aria-labelledby="health-substrate"] li');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent).toContain('Awaiting Credentials');
      expect(row.textContent).not.toContain('Connected');
    }
  });

  it('keeps the substrate statement offline when no probe backs the claim', () => {
    renderHealth(withUnverifiedSubstrate(buildDemoDataset(now)));

    expect(screen.getByText('offline')).toBeDefined();
    expect(screen.getByText(/No substrate connection is verified/)).toBeDefined();
  });
});

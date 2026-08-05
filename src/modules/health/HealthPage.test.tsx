import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SovereignContext, type SovereignContextValue } from '@/app/context';
import { buildDemoDataset } from '@/data/seed';
import { HealthPage } from './HealthPage';

const now = new Date('2026-08-05T07:30:00.000Z');

function renderHealth() {
  const value: SovereignContextValue = {
    dataset: buildDemoDataset(now),
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
});

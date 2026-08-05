import { describe, expect, it } from 'vitest';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import { buildDemoDataset } from '@/data/seed';
import type { Integration, IntegrationState } from '@/domain';
import { buildHealthReport, probeStatus, verifiedIntegrations } from './health';

const now = new Date('2026-08-05T07:30:00.000Z');
const stamp = now.toISOString();

function integration(
  id: string,
  state: IntegrationState,
  extra: Partial<Integration> = {},
): Integration {
  return {
    id,
    name: id,
    source: 'local',
    createdAt: stamp,
    updatedAt: stamp,
    category: 'data',
    state,
    capabilities: [],
    rationale: '',
    substrate: false,
    ...extra,
  };
}

function datasetOf(integrations: Integration[]): SovereignDataset {
  return { ...emptyDataset, integrations };
}

describe('health honesty', () => {
  it('reports offline and zero verified for the shipped registry', () => {
    const report = buildHealthReport(buildDemoDataset(now));

    expect(report.counts.connected).toBe(0);
    expect(report.substrate.status).toBe('offline');
    expect(report.substrate.connected).toBe(0);
    expect(verifiedIntegrations(buildDemoDataset(now).integrations)).toHaveLength(0);
  });

  it('never claims a probe ran when no integration records one', () => {
    const report = buildHealthReport(buildDemoDataset(now));

    expect(report.probe.hasRun).toBe(false);
    expect(report.probe.lastProbedAt).toBeUndefined();
    expect(report.probe.statement).toContain('No health probe has ever run');
  });

  it('acknowledges a probe only when the registry carries one', () => {
    const probed = probeStatus([
      integration('a', 'awaiting_credentials'),
      integration('b', 'connected', { lastProbedAt: stamp }),
    ]);

    expect(probed.hasRun).toBe(true);
    expect(probed.lastProbedAt).toBe(stamp);
  });

  it('cannot report operational while a substrate member is unverified', () => {
    const report = buildHealthReport(
      datasetOf([
        integration('a', 'connected', { substrate: true }),
        integration('b', 'awaiting_credentials', { substrate: true }),
      ]),
    );

    expect(report.substrate.status).toBe('degraded');
  });

  it('only reports operational when every eligible substrate member is connected', () => {
    const report = buildHealthReport(
      datasetOf([
        integration('a', 'connected', { substrate: true }),
        integration('b', 'disabled', { substrate: true }),
      ]),
    );

    expect(report.substrate.status).toBe('operational');
    expect(report.substrate.total).toBe(1);
  });

  it('derives every count from the registry rather than from a status table', () => {
    const report = buildHealthReport(
      datasetOf([
        integration('a', 'connected'),
        integration('b', 'disabled'),
        integration('c', 'awaiting_credentials'),
      ]),
    );

    expect(report.total).toBe(3);
    expect(report.counts).toEqual({ connected: 1, disabled: 1, awaiting_credentials: 1 });
    expect(report.categories.reduce((sum, row) => sum + row.total, 0)).toBe(3);
  });

  it('names the capabilities the registry says cannot run', () => {
    const report = buildHealthReport(
      datasetOf([
        integration('n8n', 'awaiting_credentials', { capabilities: ['Publish fan-out'] }),
        integration('local', 'connected', { capabilities: ['Nothing blocked'] }),
        integration('off', 'disabled', { capabilities: ['Intentionally off'] }),
      ]),
    );

    expect(report.blockedCapabilities).toEqual([
      { integrationId: 'n8n', integrationName: 'n8n', capability: 'Publish fan-out' },
    ]);
  });

  it('shows recorded events only, newest first, with no synthetic telemetry', () => {
    const dataset = buildDemoDataset(now);
    const report = buildHealthReport(dataset, 3);

    expect(report.events).toHaveLength(3);
    expect(report.events.every((event) => dataset.events.includes(event))).toBe(true);
    const timestamps = report.events.map((event) => Date.parse(event.at));
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it('says so plainly when the store holds no integrations at all', () => {
    const report = buildHealthReport(emptyDataset);

    expect(report.total).toBe(0);
    expect(report.substrate.status).toBe('offline');
    expect(report.events).toHaveLength(0);
  });
});

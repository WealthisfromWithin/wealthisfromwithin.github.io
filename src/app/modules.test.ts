import { describe, expect, it } from 'vitest';
import {
  enabledModules,
  enabledRecordRoutes,
  moduleRegistry,
  modulesByGroup,
  plannedModules,
  recordRoutes,
} from './modules';
import { routes } from './router';

/** Wave 3 enables revenue, execution, and time; Wave 4+ stays hidden. */
const WAVE_3_ENABLED = [
  'approvals',
  'brief',
  'calendar',
  'crm',
  'health',
  'inbox',
  'integrations',
  'meetings',
  'pipeline',
  'projects',
  'settings',
  'tasks',
];

function servedPaths(): string[] {
  return (routes[0]?.children ?? []).map((child) => child.path ?? (child.index ? 'index' : ''));
}

describe('module registry', () => {
  it('enables exactly the Wave 1, Wave 2, and Wave 3 modules', () => {
    expect(enabledModules().map((module) => module.id).sort()).toEqual(WAVE_3_ENABLED);
  });

  it('splits the enabled modules across Commander and Operator', () => {
    expect(modulesByGroup('commander').map((module) => module.id)).toEqual([
      'brief',
      'approvals',
      'health',
    ]);
    expect(modulesByGroup('operator').map((module) => module.id)).toEqual([
      'inbox',
      'crm',
      'pipeline',
      'tasks',
      'projects',
      'calendar',
      'meetings',
      'integrations',
      'settings',
    ]);
  });

  it('keeps unfinished modules out of navigation', () => {
    const navigable = new Set(
      [...modulesByGroup('commander'), ...modulesByGroup('operator')].map((module) => module.id),
    );
    for (const module of plannedModules()) {
      expect(navigable.has(module.id)).toBe(false);
    }
  });

  it('leaves every Wave 4+ module planned', () => {
    for (const module of moduleRegistry) {
      if (module.wave > 3) expect(module.status).toBe('planned');
    }
  });

  it('leaves Mission Control planned: it is not one of the audit Wave 3 items', () => {
    expect(moduleRegistry.find((module) => module.id === 'missions')?.status).toBe('planned');
  });

  it('has unique ids and paths', () => {
    const ids = moduleRegistry.map((module) => module.id);
    const paths = moduleRegistry.map((module) => module.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('routes exactly the enabled modules, their record routes, and a catch-all', () => {
    const expected = [
      ...enabledModules().map((module) =>
        module.path === '/' ? 'index' : module.path.replace(/^\//, ''),
      ),
      ...enabledRecordRoutes().map((record) => record.pattern.replace(/^\//, '')),
      '*',
    ];
    expect(servedPaths()).toEqual(expected);
  });

  it('gives every planned module a route the router refuses to serve', () => {
    const served = new Set(servedPaths().map((path) => `/${path}`));
    for (const module of plannedModules()) {
      expect(served.has(module.path)).toBe(false);
    }
  });

  it('serves a record route only while its module is enabled', () => {
    const enabled = new Set(enabledModules().map((module) => module.id));
    for (const record of recordRoutes) {
      expect(enabledRecordRoutes().includes(record)).toBe(enabled.has(record.moduleId));
    }
    expect(enabledRecordRoutes().map((record) => record.id)).toEqual([
      'crm-person',
      'crm-company',
      'pipeline-opportunity',
    ]);
  });

  it('declares every record route against a module that owns its path prefix', () => {
    const paths = new Map(moduleRegistry.map((module) => [module.id, module.path]));
    for (const record of recordRoutes) {
      const modulePath = paths.get(record.moduleId);
      expect(modulePath).toBeDefined();
      expect(record.pattern.startsWith(`${String(modulePath)}/`)).toBe(true);
      expect(record.pattern.endsWith('/:id')).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { enabledModules, moduleRegistry, modulesByGroup, plannedModules } from './modules';
import { routes } from './router';

describe('module registry', () => {
  it('enables exactly the Wave 1 and Wave 2 modules', () => {
    expect(enabledModules().map((module) => module.id).sort()).toEqual([
      'approvals',
      'brief',
      'health',
      'inbox',
      'integrations',
      'settings',
    ]);
  });

  it('splits the enabled modules across Commander and Operator', () => {
    expect(modulesByGroup('commander').map((module) => module.id)).toEqual([
      'brief',
      'approvals',
      'health',
    ]);
    expect(modulesByGroup('operator').map((module) => module.id)).toEqual([
      'inbox',
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

  it('leaves every Wave 3+ module planned', () => {
    for (const module of moduleRegistry) {
      if (module.wave > 2) expect(module.status).toBe('planned');
    }
  });

  it('has unique ids and paths', () => {
    const ids = moduleRegistry.map((module) => module.id);
    const paths = moduleRegistry.map((module) => module.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('routes exactly the enabled modules plus a catch-all', () => {
    const children = routes[0]?.children ?? [];
    const paths = children.map((child) => child.path ?? (child.index ? 'index' : ''));
    const expected = enabledModules().map((module) =>
      module.path === '/' ? 'index' : module.path.replace(/^\//, ''),
    );
    expect(paths).toEqual([...expected, '*']);
  });

  it('gives every planned module a route the router refuses to serve', () => {
    const served = new Set(
      (routes[0]?.children ?? []).map((child) => `/${child.path ?? ''}`.replace('//', '/')),
    );
    for (const module of plannedModules()) {
      expect(served.has(module.path)).toBe(false);
    }
  });
});

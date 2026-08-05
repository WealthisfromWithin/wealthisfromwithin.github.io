import { describe, expect, it } from 'vitest';
import { enabledModules, moduleRegistry, modulesByGroup, plannedModules } from './modules';
import { routes } from './router';

describe('module registry', () => {
  it('enables only the Wave 1 modules', () => {
    expect(enabledModules().map((module) => module.id).sort()).toEqual([
      'brief',
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

  it('has unique ids and paths', () => {
    const ids = moduleRegistry.map((module) => module.id);
    const paths = moduleRegistry.map((module) => module.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('routes exactly the enabled modules plus a catch-all', () => {
    const children = routes[0]?.children ?? [];
    const paths = children.map((child) => child.path ?? (child.index ? 'index' : ''));
    expect(paths).toEqual(['index', 'integrations', 'settings', '*']);
  });
});
